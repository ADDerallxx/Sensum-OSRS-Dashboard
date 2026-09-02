import fs from 'node:fs';import {actionRate,expectedDps,meleeAccuracy,meleeMaxHit,recipeMargin} from './osrs-v1.mjs';
const registry=JSON.parse(fs.readFileSync('platform/contracts/formula-registry-v1.json','utf8')),tests=[];
const test=(name,actual,expected,tolerance=0)=>tests.push({name,actual,expected,tolerance,passed:Math.abs(actual-expected)<=tolerance});
test('equal attack and defence rolls',meleeAccuracy({attackRoll:100,defenceRoll:100}),100/202,1e-12);
test('accuracy remains bounded at zero',meleeAccuracy({attackRoll:0,defenceRoll:100}),0);
test('basic maximum hit rounding',meleeMaxHit({effectiveStrength:50,meleeStrengthBonus:0}),5);
test('four-tick perfect accuracy DPS',expectedDps({accuracy:1,maxHit:10,attackSpeedTicks:4}),5/2.4,1e-12);
test('four-tick actions in one minute',actionRate({ticksPerAction:4,sessionSeconds:60}),25);
test('recipe margin applies configured tax',recipeMargin({inputCost:100,outputPrice:200,outputQuantity:1,taxRate:.02,taxCap:5000000}),96);
const computational=tests.every(x=>x.passed),allVerified=registry.formulas.every(x=>x.state==='verified'),report={contract:'sensum.formula-verification-report.v1',generatedAt:new Date().toISOString(),computationalTestsPassed:computational,sourceBackedVectorsApproved:allVerified,absoluteBestFormulaGate:computational&&allVerified?'open':'blocked',tests,formulas:registry.formulas.map(x=>({key:x.key,version:x.version,state:x.state,source:x.source}))};
console.log(JSON.stringify(report,null,2));if(!computational)process.exit(1);

