import { runRollouts } from "./rollout.js";
import { RULES_VERSION } from "../../rules/index.js";
import { POLICY_VERSION } from "../../policies/versions.js";
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
    if (rulesVersion !== RULES_VERSION) throw Error("Worker rules mismatch");
    if (
      protocolVersion !== 1 ||
      !policyVersion ||
      policyVersion !== POLICY_VERSION
    )
      throw Error("Worker protocol/policy mismatch");
    const stats = runRollouts(data);
    self.postMessage({ ...identity, stats }, [stats.histogram.buffer]);
  } catch (error) {
    self.postMessage({
      ...identity,
      error: String(error.message || error),
      stack: error.stack,
    });
  }
};
