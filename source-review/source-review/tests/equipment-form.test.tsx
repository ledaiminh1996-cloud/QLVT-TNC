import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentFormFields, equipmentTableDefinition, initialCondition } from '../src/api/equipmentFormFields';
import { definitions } from '../src/api/catalogFields';
import type { CatalogRow } from '../src/api/catalogClient';

test('equipment forms show matching fields and preserve parameter values independently of labels',()=>{
  const params:CatalogRow[]=[{id:'r',version:1,group_key:'route',code:'BNAM',name:'Đường dài',is_active:1},{id:'s',version:1,group_key:'source',code:'TTC',name:'Thuê tài chính',is_active:1},{id:'c',version:1,group_key:'condition',code:'HD',name:'Hoạt động',is_active:1}];
  const fields=equipmentFormFields('vehicles','tractor',params,{route_group:'BNAM',original_status:'Hoạt động'});
  const keys=fields.map(f=>f.key);
  for(const key of ['plate_number','brand_model','manufacture_year','chassis_number','engine_number','load_spec','route_group','ownership_source','original_status'])assert.ok(keys.includes(key));
  for(const key of ['current_odo_km','container_spec','generator_type','status','assigned_driver_id'])assert.ok(!keys.includes(key));
  assert.deepEqual(fields.find(f=>f.key==='route_group')!.choices![1],['BNAM','BNAM — Đường dài']);
  assert.deepEqual(fields.find(f=>f.key==='ownership_source')!.choices![1],['Thuê tài chính','Thuê tài chính']);
  const trailer=equipmentFormFields('vehicles','trailer',params,{});
  assert.equal(trailer.find(f=>f.key==='load_spec')!.label,'Tải trọng');
  for(const key of ['engine_number','current_odo_km','route_group','container_spec','generator_type','status'])assert.ok(!trailer.some(f=>f.key===key));
  const cont=equipmentFormFields('equipment','container',params,{}).map(f=>f.key);
  assert.ok(cont.includes('container_spec'));assert.ok(!cont.includes('engine_number'));assert.ok(!cont.includes('operating_hours'));
  const legacy=equipmentFormFields('vehicles','tractor',params,{ownership_source:'Giá trị lịch sử'}).find(f=>f.key==='ownership_source')!;
  assert.ok(legacy.choices!.some(([value])=>value==='Giá trị lịch sử'));
});

test('remaining device columns follow source data and keep a single status',()=>{
 for(const type of ['generator','container']) {
  const definition=equipmentTableDefinition(definitions.equipment,type);
  assert.ok(definition.columns.includes('status'));assert.ok(!definition.columns.includes('operating_hours'));assert.ok(!definition.columns.includes('original_status'));
 }
 assert.deepEqual(equipmentTableDefinition(definitions.vehicles,undefined,'office_and_box').columns.slice(0,3),['plate_number','source_group','brand_model']);
 const rented=equipmentFormFields('vehicles','rented_truck',[],{}).map(field=>field.key);
 assert.ok(rented.includes('lessor_name'));assert.ok(!rented.includes('chassis_number'));assert.ok(!rented.includes('current_odo_km'));
});


test('merged generator and container catalog hides unused fields and keeps subtype-specific forms',()=>{
 const columns=equipmentTableDefinition(definitions.equipment,undefined,'generator_container').columns;
 assert.deepEqual(columns,['code','type','container_spec','location_unit','status','notes']);
 const generator=equipmentFormFields('equipment','generator',[],{}).map(f=>f.key);
 const container=equipmentFormFields('equipment','container',[],{}).map(f=>f.key);
 assert.deepEqual(generator,['type','code','original_status','notes']);
 assert.deepEqual(container,['type','code','container_spec','location_unit','original_status','notes']);
});


test('new equipment defaults to active with no placeholder status and stopped labels are canonical',()=>{
 assert.equal(initialCondition(),'Hoạt động');
 assert.equal(initialCondition({id:'old',version:1,status:'stopped',original_status:'Ngưng sử dụng'}),'Ngừng hoạt động');
 const fields=equipmentFormFields('equipment','generator',[{id:'active',version:1,group_key:'condition',name:'Hoạt động',is_active:1},{id:'stopped',version:1,group_key:'condition',name:'Ngừng hoạt động',is_active:1}],{original_status:initialCondition()});
 assert.deepEqual(fields.find(f=>f.key==='original_status')!.choices,[['Hoạt động','Hoạt động'],['Ngừng hoạt động','Ngừng hoạt động']]);
});
