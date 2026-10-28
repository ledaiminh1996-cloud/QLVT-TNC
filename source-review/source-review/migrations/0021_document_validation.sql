-- Local preparation migration, not applied to Cloudflare yet.
ALTER TABLE parts ADD COLUMN is_fuel INTEGER NOT NULL DEFAULT 0 CHECK(is_fuel IN (0,1));
ALTER TABLE parts ADD COLUMN needs_data_package INTEGER NOT NULL DEFAULT 0 CHECK(needs_data_package IN (0,1));
-- One-time conversion of the existing catalog. Runtime rules use flags, never SKU names.
UPDATE parts SET is_fuel=1 WHERE upper(sku)='M-DC-TIEU-0020';
UPDATE parts SET needs_data_package=1 WHERE upper('-'||sku||'-') LIKE '%-SIM-%';
CREATE TABLE document_draft_lines_v2(id TEXT NOT NULL,document_id TEXT NOT NULL REFERENCES document_drafts(id),line_number INTEGER NOT NULL,part_id TEXT NOT NULL REFERENCES parts(id),line_json TEXT NOT NULL CHECK(json_valid(line_json)),PRIMARY KEY(document_id,id),UNIQUE(document_id,line_number));
INSERT INTO document_draft_lines_v2 SELECT * FROM document_draft_lines;
DROP TABLE document_draft_lines;
ALTER TABLE document_draft_lines_v2 RENAME TO document_draft_lines;
CREATE INDEX idx_draft_lines_document ON document_draft_lines(document_id,line_number);

UPDATE document_drafts SET search_text=search_text||' '||lower(replace(replace(code,'Đ','d'),'đ','d'));
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̀',''),'́',''),'̂',''),'̃',''),'̄',''),'̅',''),'̆',''),'̇',''),'̈',''),'̉','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̊',''),'̋',''),'̌',''),'̍',''),'̎',''),'̏',''),'̐',''),'̑',''),'̒',''),'̓','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̔',''),'̕',''),'̖',''),'̗',''),'̘',''),'̙',''),'̚',''),'̛',''),'̜',''),'̝','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̞',''),'̟',''),'̠',''),'̡',''),'̢',''),'̣',''),'̤',''),'̥',''),'̦',''),'̧','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̨',''),'̩',''),'̪',''),'̫',''),'̬',''),'̭',''),'̮',''),'̯',''),'̰',''),'̱','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̲',''),'̳',''),'̴',''),'̵',''),'̶',''),'̷',''),'̸',''),'̹',''),'̺',''),'̻','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'̼',''),'̽',''),'̾',''),'̿',''),'̀',''),'́',''),'͂',''),'̓',''),'̈́',''),'ͅ','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'͆',''),'͇',''),'͈',''),'͉',''),'͊',''),'͋',''),'͌',''),'͍',''),'͎',''),'͏','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'͐',''),'͑',''),'͒',''),'͓',''),'͔',''),'͕',''),'͖',''),'͗',''),'͘',''),'͙','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'͚',''),'͛',''),'͜',''),'͝',''),'͞',''),'͟',''),'͠',''),'͡',''),'͢',''),'ͣ','');
UPDATE document_drafts SET search_text=replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(search_text,'ͤ',''),'ͥ',''),'ͦ',''),'ͧ',''),'ͨ',''),'ͩ',''),'ͪ',''),'ͫ',''),'ͬ',''),'ͭ','');
UPDATE document_drafts SET search_text=replace(replace(search_text,'ͮ',''),'ͯ','');
UPDATE document_drafts SET search_text=replace(search_text,'đ','d')||' '||lower(coalesce((SELECT group_concat(json_extract(line_json,'$.serial')||' '||json_extract(line_json,'$.tank_id')||' '||json_extract(line_json,'$.data_package'),' ') FROM document_draft_lines WHERE document_id=document_drafts.id),''));
