import {BRIMHAVEN_PASSIVE_RATE_CONTRACT,evaluateBrimhavenPassiveRate,validateBrimhavenPassiveRateModel} from './brimhaven-passive-v1.mjs';

const handlers=new Map([
  [BRIMHAVEN_PASSIVE_RATE_CONTRACT,{validate:validateBrimhavenPassiveRateModel,evaluate:evaluateBrimhavenPassiveRate}]
]);

export function validateExpectedRateModel(model){
  const handler=handlers.get(model?.contract);
  return handler?handler.validate(model):{valid:false,blockers:['expected_rate_model_contract_unsupported']};
}

export function evaluateExpectedRateModel(model,baseLevel){
  const handler=handlers.get(model?.contract);
  return handler?handler.evaluate(model,baseLevel):{status:'blocked',blockers:['expected_rate_model_contract_unsupported']};
}
