INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,reason,request_id)
SELECT 'correct-auto-team-a20b07ff', 'ca2b8a1b-d6f5-4cf0-9232-64445c8bd0dc','catalog.update','departments',id,
json_object('id',id,'code',code,'name',name,'unit_id',unit_id,'kind',kind,'is_active',is_active,'version',version),
json_object('id',id,'code',code,'name',name,'unit_id',unit_id,'kind',kind,'is_active',0,'version',version+1),
'Bỏ Đội xe hệ thống tự tạo theo yêu cầu; chưa có thành viên','correct-personnel-tabs-20261021'
FROM departments WHERE id='a20b07ff-6155-4552-835d-c0096d8e4268' AND code='TNC-DX-A20B07FF' AND name='Đội xe' AND kind='driver' AND is_active=1 AND NOT EXISTS(SELECT 1 FROM staff WHERE department_id=departments.id) ON CONFLICT(id) DO NOTHING;
UPDATE departments SET is_active=0,version=version+1 WHERE id='a20b07ff-6155-4552-835d-c0096d8e4268' AND code='TNC-DX-A20B07FF' AND name='Đội xe' AND kind='driver' AND is_active=1 AND NOT EXISTS(SELECT 1 FROM staff WHERE department_id=departments.id);
