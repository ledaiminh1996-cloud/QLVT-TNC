import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogClient } from '../src/api/catalogClient';
import { createParameterCatalogClient } from '../src/api/parameterCatalogClient';

test('parameter tabs share one read, expire, invalidate after save and refresh', async () => {
  let reads=0; let clock=0;
  const api=createCatalogClient((async (_input,init)=>{
    if(init?.method==='POST')return Response.json({data:{id:'saved',version:1}});
    reads++;
    return Response.json({data:[{id:'r',version:reads,code:'BNAM',name:'Đường dài',group_key:'route',is_active:1},{id:'t',version:reads,code:'DK',name:'Đầu kéo',group_key:'equipment_type',is_active:1}],pagination:{page:1,page_size:100,total:2}});
  }) as typeof fetch);
  const cache=createParameterCatalogClient(api,()=>clock);
  const [route,type]=await Promise.all([cache.client.list('equipment-parameters',{group_key:'route'}),cache.client.list('equipment-parameters',{group_key:'equipment_type'})]);
  assert.equal(reads,1);assert.equal(route.data[0].code,'BNAM');assert.equal(type.data[0].code,'DK');
  assert.equal((await cache.client.list('equipment-parameters',{q:'đầu'})).pagination.total,1);
  clock=30001;await cache.client.list('equipment-parameters');assert.equal(reads,2);
  await cache.client.save('equipment-parameters',{name:'Sửa'});await cache.client.list('equipment-parameters');assert.equal(reads,3);
  cache.clear();await cache.client.list('equipment-parameters');assert.equal(reads,4);cache.dispose();
});

test('failed parameter reads never fall back to cached data; cancellation stays effective', async () => {
  let fail=false;
  const api=createCatalogClient((async()=>{if(fail)throw new TypeError('offline');return Response.json({data:[],pagination:{page:1,page_size:100,total:0}});}) as typeof fetch);
  const cache=createParameterCatalogClient(api);await cache.client.list('equipment-parameters');fail=true;cache.clear();
  await assert.rejects(cache.client.list('equipment-parameters'));await assert.rejects(cache.client.list('equipment-parameters'));
  const controller=new AbortController();controller.abort();await assert.rejects(cache.client.list('equipment-parameters',{signal:controller.signal}));cache.dispose();
});
