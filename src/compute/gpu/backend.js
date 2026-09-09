import { tiles, cards } from "../../rules/index.js";
import { toLegacy } from "../../environment/state.js";
import { buildX36GpuLookupData } from "../../policies/g3/gpu-tables.js";
import { shaderSource } from "./shader.js";
export function gpuTables() {
  return {
    stageId: tiles.map((t) => t.stage),
    stageMove: tiles.map((t) => t.jump || 0),
    stageEvent: tiles.map((t) => t.event || 0),
    cardType: cards.map((c) => c?.type || 0),
    cardValue: cards.map((c) => c?.value || 0),
  };
}
export class GpuBackend {
  constructor() {
    this.ready = null;
    this.tail = Promise.resolve();
    this.buffers = [];
    this.capacity = 0;
    this.disposed = false;
  }
  async prepare() {
    if (this.disposed) throw Error("GPU backend disposed");
    if (this.lost)
      throw Error(
        `GPU 연결이 종료되었습니다. CPU로 전환하거나 페이지를 새로고침해 주세요. ${this.lost}`,
      );
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (!navigator.gpu)
        throw Error(
          "이 브라우저는 WebGPU를 지원하지 않습니다. CPU를 선택해 주세요.",
        );
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter) throw Error("GPU를 사용할 수 없습니다.");
      const device = await adapter.requestDevice();
      if (this.disposed) {
        device.destroy();
        throw Error("GPU backend disposed");
      }
      this.device = device;
      this.adapter = adapter;
      device.lost.then((info) => {
        if (!this.disposed && info.reason !== "destroyed")
          this.lost = info.message || "GPU device lost";
      });
      const tables = gpuTables(),
        module = device.createShaderModule({ code: shaderSource(tables) }),
        info = await module.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === "error");
      if (errors.length) throw Error(errors.map((m) => m.message).join("\n"));
      this.pipeline = await device.createComputePipelineAsync({
        layout: "auto",
        compute: { module, entryPoint: "main" },
      });
      const storage = (values) => {
        const b = device.createBuffer({
          size: Math.max(4, values.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(b, 0, values);
        this.buffers.push(b);
        return b;
      };
      this.fixed = [
        storage(buildX36GpuLookupData(tables)),
        storage(new Int32Array(tables.stageMove)),
        storage(new Int32Array(tables.stageEvent)),
        storage(new Int32Array(tables.cardType)),
        storage(new Int32Array(tables.cardValue)),
      ];
      this.input = storage(new Int32Array(48));
      this.params = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.buffers.push(this.params);
      return {
        name: adapter.info?.description || adapter.info?.device || "WebGPU",
        available: true,
      };
    })().catch((error) => {
      this.buffers.forEach((b) => b.destroy());
      this.buffers = [];
      this.device?.destroy();
      this.ready = null;
      throw error;
    });
    return this.ready;
  }
  run(job, signal) {
    const task = this.tail
      .catch(() => {})
      .then(() => this.execute(job, signal));
    this.tail = task;
    return task;
  }
  async execute({ snapshot, actions, count, seed }, signal) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    await this.prepare();
    if (this.lost) throw Error(this.lost);
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      !actions.length ||
      actions.some(
        (a) => !Number.isInteger(a) || a < 0 || a > snapshot.hand.length,
      )
    )
      throw Error("Invalid GPU batch");
    const device = this.device,
      groups = Math.ceil(count / 64),
      bytes = groups * actions.length * 6 * 4;
    if (
      groups > device.limits.maxComputeWorkgroupsPerDimension ||
      bytes > device.limits.maxStorageBufferBindingSize ||
      bytes > device.limits.maxBufferSize
    )
      throw Error("GPU batch exceeds device limits");
    if (bytes > this.capacity) {
      this.partial?.destroy();
      this.readback?.destroy();
      this.capacity = bytes;
      this.partial = device.createBuffer({
        size: bytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      this.readback = device.createBuffer({
        size: bytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
    }
    const state = new Int32Array(48);
    state.set(toLegacy(snapshot));
    state.set(actions, 42);
    device.queue.writeBuffer(this.input, 0, state);
    device.queue.writeBuffer(
      this.params,
      0,
      new Uint32Array([count, 0, seed >>> 0, 512, actions.length, 2, 0, 0]),
    );
    const bind = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [...this.fixed, this.input, this.partial, this.params].map(
        (buffer, binding) => ({ binding, resource: { buffer } }),
      ),
    });
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(groups, actions.length);
    pass.end();
    encoder.copyBufferToBuffer(this.partial, 0, this.readback, 0, bytes);
    device.queue.submit([encoder.finish()]);
    await this.readback.mapAsync(GPUMapMode.READ, 0, bytes);
    const data = new Uint32Array(
      this.readback.getMappedRange(0, bytes),
    ).slice();
    this.readback.unmap();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    return actions.map((action, index) => {
      const stats = {
        action,
        count: 0,
        sum: 0,
        sumSq: 0,
        min: Infinity,
        max: -Infinity,
        truncated: 0,
      };
      for (let g = 0; g < groups; g++) {
        const b = (index * groups + g) * 6;
        if (!data[b]) continue;
        stats.count += data[b];
        stats.sum += data[b + 1];
        stats.sumSq += data[b + 2];
        stats.min = Math.min(stats.min, data[b + 3]);
        stats.max = Math.max(stats.max, data[b + 4]);
        stats.truncated += data[b + 5];
      }
      return stats;
    });
  }
  async reset() {
    await this.dispose();
    this.buffers = [];
    this.capacity = 0;
    this.partial = null;
    this.readback = null;
    this.lost = null;
    this.disposed = false;
  }
  async dispose() {
    this.disposed = true;
    await this.tail.catch(() => {});
    await this.ready?.catch(() => {});
    this.partial?.destroy();
    this.readback?.destroy();
    this.buffers.forEach((b) => b.destroy());
    this.device?.destroy();
    this.ready = null;
  }
}
