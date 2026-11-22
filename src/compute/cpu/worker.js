import { runRollouts } from "./rollout.js";
import { RULES_VERSION } from "../../rules/index.js";
import { POLICY_VERSION } from "../../policies/versions.js";
import { versionMismatch } from "../version.js";
self.onmessage = ({ data }) => {
  const {
    id,
    requestId,
    revision,
    rulesVersion,
    protocolVersion,
    policyVersion,
    batchId,
  } = data;
  const identity = {
    id,
    requestId,
    revision,
    rulesVersion,
    protocolVersion,
    policyVersion,
    batchId,
  };
  try {
    // 화면이 보낸 규칙·프로토콜·정책 버전이 이 worker의 것과 다르면 서로 다른 배포에서 온 것이다.
    if (
      rulesVersion !== RULES_VERSION ||
      protocolVersion !== 1 ||
      policyVersion !== POLICY_VERSION
    )
      throw versionMismatch();
    const stats = runRollouts(data);
    self.postMessage({ ...identity, stats }, [stats.histogram.buffer]);
  } catch (error) {
    self.postMessage({
      ...identity,
      error: String(error.message || error),
      code: error.code,
      stack: error.stack,
    });
  }
};
