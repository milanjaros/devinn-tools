import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);throw error;}}});
const { demoDataset } = await import('../src/data/demo.ts');
const { contactVcard } = await import('../src/domain/contacts.ts');
const { validateDataset, importDataset, exportDataset } = await import('../src/domain/validation.ts');
const { emptyDataset } = await import('../src/domain/models.ts');

test('Vnořené vztahy převezmou ID varianty, samostatné vyžadují platné scenarioId',()=>{
  for(const scenarioId of [undefined,'old-scenario']){
    const json=JSON.parse(exportDataset(demoDataset(),'all'));
    json.scenarios[0].id='renamed-scenario';json.activeScenarioId='renamed-scenario';
    json.scenarios[0].relationships.forEach(r=>r.scenarioId=scenarioId);
    const result=importDataset(demoDataset(),json,'replace');
    assert.ok(result.scenarios[0].relationships.every(r=>r.scenarioId==='renamed-scenario'));
  }
  const data=demoDataset(),relation={id:'top-level',sourceId:'p001',targetId:'p002',type:'project',primary:false};
  assert.throws(()=>importDataset(data,{schemaVersion:1,relationships:[relation]},'merge'),/musí obsahovat scenarioId/);
  assert.throws(()=>importDataset(data,{schemaVersion:1,relationships:[{...relation,scenarioId:'missing'}]},'merge'),/Neexistující varianta/);
  const result=importDataset(data,{schemaVersion:1,relationships:[{...relation,scenarioId:'current'}]},'merge');
  assert.ok(result.scenarios[0].relationships.some(r=>r.id==='top-level'&&r.scenarioId==='current'));
});

test('Oddělení může být prázdné, chybějící nebo null u lidí i pozic',()=>{
  for(const department of ['', '   ', undefined, null]){
    const json=JSON.parse(exportDataset(demoDataset(),'all'));
    json.people[14].department=department;
    json.scenarios[0].positions.push({id:'without-department',position:'Architekt',department,tagIds:[],status:'vacant'});
    const result=importDataset(demoDataset(),json,'replace');
    assert.equal(result.people[14].department,'');
    assert.equal(result.scenarios[0].positions[0].department,'');
    assert.equal(validateDataset(result).people[14].department,'');
    assert.equal(JSON.parse(exportDataset(result,'all')).people[14].department,'');
  }
});

test('JSON používá position pro lidi i pozice, employer a zpětně načte title',()=>{
  const data=demoDataset();
  data.people[0].employer='Zaměstnavatel s.r.o.';
  data.scenarios[0].positions.push({id:'vacant-test',title:'Architekt',department:'Vývoj',tagIds:[],status:'vacant'});
  for(const scope of ['all','people','scenario']){
    const json=JSON.parse(exportDataset(data,scope));
    assert.equal(json.people[0].position,data.people[0].title);
    assert.equal(json.people[0].employer,'Zaměstnavatel s.r.o.');
    assert.ok(!Object.hasOwn(json.people[0],'title'));
    if(scope!=='people'){
      assert.equal(json.scenarios[0].positions[0].position,'Architekt');
      assert.ok(!Object.hasOwn(json.scenarios[0].positions[0],'title'));
    }
    const restored=importDataset(demoDataset(),json,'replace');
    assert.deepEqual(restored.people,data.people);
    if(scope!=='people')assert.deepEqual(restored.scenarios[0].positions,data.scenarios[0].positions);
  }
  assert.deepEqual(importDataset(demoDataset(),JSON.parse(JSON.stringify(data)),'replace').people,data.people);
  const legacy=JSON.parse(JSON.stringify(data));delete legacy.people[0].employer;
  assert.equal(importDataset(demoDataset(),legacy,'replace').people[0].employer,'');
  const newer=JSON.parse(exportDataset(data,'all'));newer.people[0].title='Starý název';
  assert.equal(importDataset(data,newer,'replace').people[0].title,data.people[0].title);
  newer.people[0].position='';assert.throws(()=>importDataset(data,newer,'replace'));
  assert.ok(!contactVcard({...data.people[0],employer:''}).includes('DEVINN'));
});

test('Prázdná organizace zůstává prázdná po uložení a exportu; stará liniová varianta se odemkne',()=>{
  const data=emptyDataset();
  const restored=validateDataset(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored,data);
  assert.equal(restored.people.length,0);assert.equal(restored.tags.length,0);
  assert.equal(restored.scenarios.length,1);assert.equal(restored.scenarios[0].protected,false);
  assert.deepEqual(importDataset(demoDataset(),JSON.parse(exportDataset(data,'all')),'replace'),data);
  const old=demoDataset();old.scenarios[0].protected=true;
  const unlocked=validateDataset(old);
  assert.equal(unlocked.scenarios[0].protected,false);
  assert.deepEqual(unlocked.people,old.people);
  assert.deepEqual(unlocked.scenarios[0].relationships,old.scenarios[0].relationships);
  assert.equal(old.scenarios[0].protected,true);
});

test('Staré JSON i uložené snapshoty dostanou prázdné kontakty bez ztráty dat',()=>{
  const old=demoDataset();
  old.people.forEach(p=>{delete p.email;delete p.phone;});
  old.scenarios.forEach(s=>delete s.view.showContacts);
  for(const restored of [validateDataset(old),importDataset(demoDataset(),old,'replace')]){
    assert.equal(restored.people.length,36);
    assert.ok(restored.people.every(p=>p.email===''&&p.phone===''));
    assert.ok(restored.scenarios.every(s=>s.view.showContacts===false));
    assert.deepEqual(restored.scenarios[0].relationships,old.scenarios[0].relationships);
  }
  assert.equal(old.people[0].email,undefined);
});

test('Všechny rozsahy JSON zachovají kontakty a fotografii',()=>{
  const data=demoDataset();Object.assign(data.people[0],{email:'jan@example.com',phone:'+420 123 456 789',employer:'Testovací firma s.r.o.',photo:'data:image/png;base64,aGVsbG8='});
  data.scenarios[0].view.showContacts=true;
  for(const scope of ['all','people','scenario']){
    const restored=importDataset(demoDataset(),JSON.parse(exportDataset(data,scope)),'replace');
    assert.deepEqual(restored.people[0],data.people[0]);
    if(scope!=='people')assert.equal(restored.scenarios[0].view.showContacts,true);
  }
  assert.throws(()=>validateDataset({...data,people:[{...data.people[0],email:'invalid'}]}));
});

test('vCard obsahuje pracovní kontakty, zaměstnavatele, oddělení a fotografii',()=>{
  const person={...demoDataset().people[0],employer:'Jiná firma s.r.o.',name:'Jan "Test";Novák\nDruhý řádek',email:'jan@example.com',phone:'+420 123 456 789',photo:'data:image/png;base64,aGVsbG8='};
  const vcf=contactVcard(person).replace(/\r\n /g,'');
  assert.ok(vcf.includes('EMAIL;TYPE=WORK:jan@example.com'));
  assert.ok(vcf.includes('PHOTO;ENCODING=b;TYPE=PNG:aGVsbG8='));
  assert.ok(vcf.includes('ORG:Jiná firma s.r.o.;'));

  assert.ok(vcf.includes('TEL;TYPE=WORK:+420 123 456 789'));
  assert.ok(vcf.endsWith('END:VCARD\r\n'));
});
