-- Rename the stopped condition without changing its code or operational meaning.
UPDATE equipment_parameters SET name='Ngừng hoạt động',version=version+1 WHERE group_key='condition' AND name IN ('Ngưng sử dụng','Ngừng sử dụng');
UPDATE vehicles SET original_status='Ngừng hoạt động',version=version+1 WHERE original_status IN ('Ngưng sử dụng','Ngừng sử dụng');
UPDATE equipment SET original_status='Ngừng hoạt động',version=version+1 WHERE original_status IN ('Ngưng sử dụng','Ngừng sử dụng');
