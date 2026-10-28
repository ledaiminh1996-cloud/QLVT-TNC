-- Derived search data only. Original display fields remain untouched.
CREATE TABLE search_character_map(character TEXT PRIMARY KEY NOT NULL, normalized TEXT NOT NULL);
CREATE TABLE catalog_search(resource TEXT NOT NULL,entity_id TEXT NOT NULL,field_key TEXT NOT NULL,normalized_text TEXT NOT NULL,PRIMARY KEY(resource,entity_id,field_key));
INSERT INTO search_character_map(character,normalized) VALUES
('À','à'),
('Á','á'),
('Â','â'),
('Ã','ã'),
('Ä','ä'),
('Å','å'),
('Æ','æ'),
('Ç','ç'),
('È','è'),
('É','é'),
('Ê','ê'),
('Ë','ë'),
('Ì','ì'),
('Í','í'),
('Î','î'),
('Ï','ï'),
('Ð','ð'),
('Ñ','ñ'),
('Ò','ò'),
('Ó','ó'),
('Ô','ô'),
('Õ','õ'),
('Ö','ö'),
('Ø','ø'),
('Ù','ù'),
('Ú','ú'),
('Û','û'),
('Ü','ü'),
('Ý','ý'),
('Þ','þ'),
('à','à'),
('á','á'),
('â','â'),
('ã','ã'),
('ä','ä'),
('å','å'),
('ç','ç'),
('è','è'),
('é','é'),
('ê','ê'),
('ë','ë'),
('ì','ì'),
('í','í'),
('î','î'),
('ï','ï'),
('ñ','ñ'),
('ò','ò'),
('ó','ó'),
('ô','ô'),
('õ','õ'),
('ö','ö'),
('ù','ù'),
('ú','ú'),
('û','û'),
('ü','ü'),
('ý','ý'),
('ÿ','ÿ'),
('Ā','ā'),
('ā','ā'),
('Ă','ă'),
('ă','ă'),
('Ą','ą'),
('ą','ą'),
('Ć','ć'),
('ć','ć'),
('Ĉ','ĉ'),
('ĉ','ĉ'),
('Ċ','ċ'),
('ċ','ċ'),
('Č','č'),
('č','č'),
('Ď','ď'),
('ď','ď'),
('Đ','đ'),
('Ē','ē'),
('ē','ē'),
('Ĕ','ĕ'),
('ĕ','ĕ'),
('Ė','ė'),
('ė','ė'),
('Ę','ę'),
('ę','ę'),
('Ě','ě'),
('ě','ě'),
('Ĝ','ĝ'),
('ĝ','ĝ'),
('Ğ','ğ'),
('ğ','ğ'),
('Ġ','ġ'),
('ġ','ġ'),
('Ģ','ģ'),
('ģ','ģ'),
('Ĥ','ĥ'),
('ĥ','ĥ'),
('Ħ','ħ'),
('Ĩ','ĩ'),
('ĩ','ĩ'),
('Ī','ī'),
('ī','ī'),
('Ĭ','ĭ'),
('ĭ','ĭ'),
('Į','į'),
('į','į'),
('İ','i̇'),
('Ĳ','ĳ'),
('Ĵ','ĵ'),
('ĵ','ĵ'),
('Ķ','ķ'),
('ķ','ķ'),
('Ĺ','ĺ'),
('ĺ','ĺ'),
('Ļ','ļ'),
('ļ','ļ'),
('Ľ','ľ'),
('ľ','ľ'),
('Ŀ','ŀ'),
('Ł','ł'),
('Ń','ń'),
('ń','ń'),
('Ņ','ņ'),
('ņ','ņ'),
('Ň','ň'),
('ň','ň'),
('Ŋ','ŋ'),
('Ō','ō'),
('ō','ō'),
('Ŏ','ŏ'),
('ŏ','ŏ'),
('Ő','ő'),
('ő','ő'),
('Œ','œ'),
('Ŕ','ŕ'),
('ŕ','ŕ'),
('Ŗ','ŗ'),
('ŗ','ŗ'),
('Ř','ř'),
('ř','ř'),
('Ś','ś'),
('ś','ś'),
('Ŝ','ŝ'),
('ŝ','ŝ'),
('Ş','ş'),
('ş','ş'),
('Š','š'),
('š','š'),
('Ţ','ţ'),
('ţ','ţ'),
('Ť','ť'),
('ť','ť'),
('Ŧ','ŧ'),
('Ũ','ũ'),
('ũ','ũ'),
('Ū','ū'),
('ū','ū'),
('Ŭ','ŭ'),
('ŭ','ŭ'),
('Ů','ů'),
('ů','ů'),
('Ű','ű'),
('ű','ű'),
('Ų','ų'),
('ų','ų'),
('Ŵ','ŵ'),
('ŵ','ŵ'),
('Ŷ','ŷ'),
('ŷ','ŷ'),
('Ÿ','ÿ'),
('Ź','ź'),
('ź','ź'),
('Ż','ż'),
('ż','ż'),
('Ž','ž'),
('ž','ž'),
('Ɓ','ɓ'),
('Ƃ','ƃ'),
('Ƅ','ƅ'),
('Ɔ','ɔ'),
('Ƈ','ƈ'),
('Ɖ','ɖ'),
('Ɗ','ɗ'),
('Ƌ','ƌ'),
('Ǝ','ǝ'),
('Ə','ə'),
('Ɛ','ɛ'),
('Ƒ','ƒ'),
('Ɠ','ɠ'),
('Ɣ','ɣ'),
('Ɩ','ɩ'),
('Ɨ','ɨ'),
('Ƙ','ƙ'),
('Ɯ','ɯ'),
('Ɲ','ɲ'),
('Ɵ','ɵ'),
('Ơ','ơ'),
('ơ','ơ'),
('Ƣ','ƣ'),
('Ƥ','ƥ'),
('Ʀ','ʀ'),
('Ƨ','ƨ'),
('Ʃ','ʃ'),
('Ƭ','ƭ'),
('Ʈ','ʈ'),
('Ư','ư'),
('ư','ư'),
('Ʊ','ʊ'),
('Ʋ','ʋ'),
('Ƴ','ƴ'),
('Ƶ','ƶ'),
('Ʒ','ʒ'),
('Ƹ','ƹ'),
('Ƽ','ƽ'),
('Ǆ','ǆ'),
('ǅ','ǆ'),
('Ǉ','ǉ'),
('ǈ','ǉ'),
('Ǌ','ǌ'),
('ǋ','ǌ'),
('Ǎ','ǎ'),
('ǎ','ǎ'),
('Ǐ','ǐ'),
('ǐ','ǐ'),
('Ǒ','ǒ'),
('ǒ','ǒ'),
('Ǔ','ǔ'),
('ǔ','ǔ'),
('Ǖ','ǖ'),
('ǖ','ǖ'),
('Ǘ','ǘ'),
('ǘ','ǘ'),
('Ǚ','ǚ'),
('ǚ','ǚ'),
('Ǜ','ǜ'),
('ǜ','ǜ'),
('Ǟ','ǟ'),
('ǟ','ǟ'),
('Ǡ','ǡ'),
('ǡ','ǡ'),
('Ǣ','ǣ'),
('ǣ','ǣ'),
('Ǥ','ǥ'),
('Ǧ','ǧ'),
('ǧ','ǧ'),
('Ǩ','ǩ'),
('ǩ','ǩ'),
('Ǫ','ǫ'),
('ǫ','ǫ'),
('Ǭ','ǭ'),
('ǭ','ǭ'),
('Ǯ','ǯ'),
('ǯ','ǯ'),
('ǰ','ǰ'),
('Ǳ','ǳ'),
('ǲ','ǳ'),
('Ǵ','ǵ'),
('ǵ','ǵ'),
('Ƕ','ƕ'),
('Ƿ','ƿ'),
('Ǹ','ǹ'),
('ǹ','ǹ'),
('Ǻ','ǻ'),
('ǻ','ǻ'),
('Ǽ','ǽ'),
('ǽ','ǽ'),
('Ǿ','ǿ'),
('ǿ','ǿ'),
('Ȁ','ȁ'),
('ȁ','ȁ'),
('Ȃ','ȃ'),
('ȃ','ȃ'),
('Ȅ','ȅ'),
('ȅ','ȅ'),
('Ȇ','ȇ'),
('ȇ','ȇ'),
('Ȉ','ȉ'),
('ȉ','ȉ'),
('Ȋ','ȋ'),
('ȋ','ȋ'),
('Ȍ','ȍ'),
('ȍ','ȍ'),
('Ȏ','ȏ'),
('ȏ','ȏ'),
('Ȑ','ȑ'),
('ȑ','ȑ'),
('Ȓ','ȓ'),
('ȓ','ȓ'),
('Ȕ','ȕ'),
('ȕ','ȕ'),
('Ȗ','ȗ'),
('ȗ','ȗ'),
('Ș','ș'),
('ș','ș'),
('Ț','ț'),
('ț','ț'),
('Ȝ','ȝ'),
('Ȟ','ȟ'),
('ȟ','ȟ'),
('Ƞ','ƞ'),
('Ȣ','ȣ'),
('Ȥ','ȥ'),
('Ȧ','ȧ'),
('ȧ','ȧ'),
('Ȩ','ȩ'),
('ȩ','ȩ'),
('Ȫ','ȫ'),
('ȫ','ȫ'),
('Ȭ','ȭ'),
('ȭ','ȭ'),
('Ȯ','ȯ'),
('ȯ','ȯ'),
('Ȱ','ȱ'),
('ȱ','ȱ'),
('Ȳ','ȳ'),
('ȳ','ȳ'),
('Ⱥ','ⱥ'),
('Ȼ','ȼ'),
('Ƚ','ƚ'),
('Ⱦ','ⱦ'),
('Ɂ','ɂ'),
('Ƀ','ƀ'),
('Ʉ','ʉ'),
('Ʌ','ʌ'),
('Ɇ','ɇ'),
('Ɉ','ɉ'),
('Ɋ','ɋ'),
('Ɍ','ɍ'),
('Ɏ','ɏ'),
('Ḁ','ḁ'),
('ḁ','ḁ'),
('Ḃ','ḃ'),
('ḃ','ḃ'),
('Ḅ','ḅ'),
('ḅ','ḅ'),
('Ḇ','ḇ'),
('ḇ','ḇ'),
('Ḉ','ḉ'),
('ḉ','ḉ'),
('Ḋ','ḋ'),
('ḋ','ḋ'),
('Ḍ','ḍ'),
('ḍ','ḍ'),
('Ḏ','ḏ'),
('ḏ','ḏ'),
('Ḑ','ḑ'),
('ḑ','ḑ'),
('Ḓ','ḓ'),
('ḓ','ḓ'),
('Ḕ','ḕ'),
('ḕ','ḕ'),
('Ḗ','ḗ'),
('ḗ','ḗ'),
('Ḙ','ḙ'),
('ḙ','ḙ'),
('Ḛ','ḛ'),
('ḛ','ḛ'),
('Ḝ','ḝ'),
('ḝ','ḝ'),
('Ḟ','ḟ'),
('ḟ','ḟ'),
('Ḡ','ḡ'),
('ḡ','ḡ'),
('Ḣ','ḣ'),
('ḣ','ḣ'),
('Ḥ','ḥ'),
('ḥ','ḥ'),
('Ḧ','ḧ'),
('ḧ','ḧ'),
('Ḩ','ḩ'),
('ḩ','ḩ'),
('Ḫ','ḫ'),
('ḫ','ḫ'),
('Ḭ','ḭ'),
('ḭ','ḭ'),
('Ḯ','ḯ'),
('ḯ','ḯ'),
('Ḱ','ḱ'),
('ḱ','ḱ'),
('Ḳ','ḳ'),
('ḳ','ḳ'),
('Ḵ','ḵ'),
('ḵ','ḵ'),
('Ḷ','ḷ'),
('ḷ','ḷ'),
('Ḹ','ḹ'),
('ḹ','ḹ'),
('Ḻ','ḻ'),
('ḻ','ḻ'),
('Ḽ','ḽ'),
('ḽ','ḽ'),
('Ḿ','ḿ'),
('ḿ','ḿ'),
('Ṁ','ṁ'),
('ṁ','ṁ'),
('Ṃ','ṃ'),
('ṃ','ṃ'),
('Ṅ','ṅ'),
('ṅ','ṅ'),
('Ṇ','ṇ'),
('ṇ','ṇ'),
('Ṉ','ṉ'),
('ṉ','ṉ'),
('Ṋ','ṋ'),
('ṋ','ṋ'),
('Ṍ','ṍ'),
('ṍ','ṍ'),
('Ṏ','ṏ'),
('ṏ','ṏ'),
('Ṑ','ṑ'),
('ṑ','ṑ'),
('Ṓ','ṓ'),
('ṓ','ṓ'),
('Ṕ','ṕ'),
('ṕ','ṕ'),
('Ṗ','ṗ'),
('ṗ','ṗ'),
('Ṙ','ṙ'),
('ṙ','ṙ'),
('Ṛ','ṛ'),
('ṛ','ṛ'),
('Ṝ','ṝ'),
('ṝ','ṝ'),
('Ṟ','ṟ'),
('ṟ','ṟ'),
('Ṡ','ṡ'),
('ṡ','ṡ'),
('Ṣ','ṣ'),
('ṣ','ṣ'),
('Ṥ','ṥ'),
('ṥ','ṥ'),
('Ṧ','ṧ'),
('ṧ','ṧ'),
('Ṩ','ṩ'),
('ṩ','ṩ'),
('Ṫ','ṫ'),
('ṫ','ṫ'),
('Ṭ','ṭ'),
('ṭ','ṭ'),
('Ṯ','ṯ'),
('ṯ','ṯ'),
('Ṱ','ṱ'),
('ṱ','ṱ'),
('Ṳ','ṳ'),
('ṳ','ṳ'),
('Ṵ','ṵ'),
('ṵ','ṵ'),
('Ṷ','ṷ'),
('ṷ','ṷ'),
('Ṹ','ṹ'),
('ṹ','ṹ'),
('Ṻ','ṻ'),
('ṻ','ṻ'),
('Ṽ','ṽ'),
('ṽ','ṽ'),
('Ṿ','ṿ'),
('ṿ','ṿ'),
('Ẁ','ẁ'),
('ẁ','ẁ'),
('Ẃ','ẃ'),
('ẃ','ẃ'),
('Ẅ','ẅ'),
('ẅ','ẅ'),
('Ẇ','ẇ'),
('ẇ','ẇ'),
('Ẉ','ẉ'),
('ẉ','ẉ'),
('Ẋ','ẋ'),
('ẋ','ẋ'),
('Ẍ','ẍ'),
('ẍ','ẍ'),
('Ẏ','ẏ'),
('ẏ','ẏ'),
('Ẑ','ẑ'),
('ẑ','ẑ'),
('Ẓ','ẓ'),
('ẓ','ẓ'),
('Ẕ','ẕ'),
('ẕ','ẕ'),
('ẖ','ẖ'),
('ẗ','ẗ'),
('ẘ','ẘ'),
('ẙ','ẙ'),
('ẛ','ẛ'),
('ẞ','ß'),
('Ạ','ạ'),
('ạ','ạ'),
('Ả','ả'),
('ả','ả'),
('Ấ','ấ'),
('ấ','ấ'),
('Ầ','ầ'),
('ầ','ầ'),
('Ẩ','ẩ'),
('ẩ','ẩ'),
('Ẫ','ẫ'),
('ẫ','ẫ'),
('Ậ','ậ'),
('ậ','ậ'),
('Ắ','ắ'),
('ắ','ắ'),
('Ằ','ằ'),
('ằ','ằ'),
('Ẳ','ẳ'),
('ẳ','ẳ'),
('Ẵ','ẵ'),
('ẵ','ẵ'),
('Ặ','ặ'),
('ặ','ặ'),
('Ẹ','ẹ'),
('ẹ','ẹ'),
('Ẻ','ẻ'),
('ẻ','ẻ'),
('Ẽ','ẽ'),
('ẽ','ẽ'),
('Ế','ế'),
('ế','ế'),
('Ề','ề'),
('ề','ề'),
('Ể','ể'),
('ể','ể'),
('Ễ','ễ'),
('ễ','ễ'),
('Ệ','ệ'),
('ệ','ệ'),
('Ỉ','ỉ'),
('ỉ','ỉ'),
('Ị','ị'),
('ị','ị'),
('Ọ','ọ'),
('ọ','ọ'),
('Ỏ','ỏ'),
('ỏ','ỏ'),
('Ố','ố'),
('ố','ố'),
('Ồ','ồ'),
('ồ','ồ'),
('Ổ','ổ'),
('ổ','ổ'),
('Ỗ','ỗ'),
('ỗ','ỗ'),
('Ộ','ộ'),
('ộ','ộ'),
('Ớ','ớ'),
('ớ','ớ'),
('Ờ','ờ'),
('ờ','ờ'),
('Ở','ở'),
('ở','ở'),
('Ỡ','ỡ'),
('ỡ','ỡ'),
('Ợ','ợ'),
('ợ','ợ'),
('Ụ','ụ'),
('ụ','ụ'),
('Ủ','ủ'),
('ủ','ủ'),
('Ứ','ứ'),
('ứ','ứ'),
('Ừ','ừ'),
('ừ','ừ'),
('Ử','ử'),
('ử','ử'),
('Ữ','ữ'),
('ữ','ữ'),
('Ự','ự'),
('ự','ự'),
('Ỳ','ỳ'),
('ỳ','ỳ'),
('Ỵ','ỵ'),
('ỵ','ỵ'),
('Ỷ','ỷ'),
('ỷ','ỷ'),
('Ỹ','ỹ'),
('ỹ','ỹ'),
('Ỻ','ỻ'),
('Ỽ','ỽ'),
('Ỿ','ỿ');
CREATE TRIGGER search_equipment_parameters_insert AFTER INSERT ON equipment_parameters BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-parameters',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-parameters',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_equipment_parameters_update AFTER UPDATE OF code,name ON equipment_parameters BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-parameters',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-parameters',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_equipment_parameters_delete AFTER DELETE ON equipment_parameters BEGIN DELETE FROM catalog_search WHERE resource='equipment-parameters' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment-parameters',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment_parameters t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment-parameters',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment_parameters t;
CREATE TRIGGER search_equipment_pairing_drafts_insert AFTER INSERT ON equipment_pairing_drafts BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-pairings',NEW.id,'parent_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.parent_code,''),position,1)),lower(substr(COALESCE(NEW.parent_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.parent_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-pairings',NEW.id,'child_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.child_code,''),position,1)),lower(substr(COALESCE(NEW.child_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.child_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-pairings',NEW.id,'updated_by_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.updated_by_name,''),position,1)),lower(substr(COALESCE(NEW.updated_by_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.updated_by_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_equipment_pairing_drafts_update AFTER UPDATE OF parent_code,child_code,updated_by_name ON equipment_pairing_drafts BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-pairings',NEW.id,'parent_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.parent_code,''),position,1)),lower(substr(COALESCE(NEW.parent_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.parent_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-pairings',NEW.id,'child_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.child_code,''),position,1)),lower(substr(COALESCE(NEW.child_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.child_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment-pairings',NEW.id,'updated_by_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.updated_by_name,''),position,1)),lower(substr(COALESCE(NEW.updated_by_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.updated_by_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_equipment_pairing_drafts_delete AFTER DELETE ON equipment_pairing_drafts BEGIN DELETE FROM catalog_search WHERE resource='equipment-pairings' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment-pairings',t.id,'parent_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.parent_code,''),position,1)),lower(substr(COALESCE(t.parent_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.parent_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment_pairing_drafts t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment-pairings',t.id,'child_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.child_code,''),position,1)),lower(substr(COALESCE(t.child_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.child_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment_pairing_drafts t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment-pairings',t.id,'updated_by_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.updated_by_name,''),position,1)),lower(substr(COALESCE(t.updated_by_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.updated_by_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment_pairing_drafts t;
CREATE TRIGGER search_equipment_insert AFTER INSERT ON equipment BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'brand_model',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.brand_model,''),position,1)),lower(substr(COALESCE(NEW.brand_model,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.brand_model,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'serial_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.serial_number,''),position,1)),lower(substr(COALESCE(NEW.serial_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.serial_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'generator_type',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.generator_type,''),position,1)),lower(substr(COALESCE(NEW.generator_type,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.generator_type,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'container_spec',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.container_spec,''),position,1)),lower(substr(COALESCE(NEW.container_spec,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.container_spec,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'route_group',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.route_group,''),position,1)),lower(substr(COALESCE(NEW.route_group,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.route_group,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'location_unit',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location_unit,''),position,1)),lower(substr(COALESCE(NEW.location_unit,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location_unit,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_equipment_update AFTER UPDATE OF code,name,brand_model,serial_number,generator_type,container_spec,route_group,location_unit ON equipment BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'brand_model',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.brand_model,''),position,1)),lower(substr(COALESCE(NEW.brand_model,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.brand_model,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'serial_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.serial_number,''),position,1)),lower(substr(COALESCE(NEW.serial_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.serial_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'generator_type',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.generator_type,''),position,1)),lower(substr(COALESCE(NEW.generator_type,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.generator_type,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'container_spec',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.container_spec,''),position,1)),lower(substr(COALESCE(NEW.container_spec,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.container_spec,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'route_group',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.route_group,''),position,1)),lower(substr(COALESCE(NEW.route_group,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.route_group,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('equipment',NEW.id,'location_unit',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location_unit,''),position,1)),lower(substr(COALESCE(NEW.location_unit,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location_unit,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_equipment_delete AFTER DELETE ON equipment BEGIN DELETE FROM catalog_search WHERE resource='equipment' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'brand_model',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.brand_model,''),position,1)),lower(substr(COALESCE(t.brand_model,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.brand_model,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'serial_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.serial_number,''),position,1)),lower(substr(COALESCE(t.serial_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.serial_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'generator_type',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.generator_type,''),position,1)),lower(substr(COALESCE(t.generator_type,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.generator_type,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'container_spec',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.container_spec,''),position,1)),lower(substr(COALESCE(t.container_spec,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.container_spec,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'route_group',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.route_group,''),position,1)),lower(substr(COALESCE(t.route_group,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.route_group,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'equipment',t.id,'location_unit',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.location_unit,''),position,1)),lower(substr(COALESCE(t.location_unit,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.location_unit,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM equipment t;
CREATE TRIGGER search_part_objects_insert AFTER INSERT ON part_objects BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-objects',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-objects',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_part_objects_update AFTER UPDATE OF code,name ON part_objects BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-objects',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-objects',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_part_objects_delete AFTER DELETE ON part_objects BEGIN DELETE FROM catalog_search WHERE resource='part-objects' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'part-objects',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM part_objects t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'part-objects',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM part_objects t;
CREATE TRIGGER search_part_groups_insert AFTER INSERT ON part_groups BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-groups',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-groups',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_part_groups_update AFTER UPDATE OF code,name ON part_groups BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-groups',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('part-groups',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_part_groups_delete AFTER DELETE ON part_groups BEGIN DELETE FROM catalog_search WHERE resource='part-groups' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'part-groups',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM part_groups t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'part-groups',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM part_groups t;
CREATE TRIGGER search_parts_insert AFTER INSERT ON parts BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'sku',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.sku,''),position,1)),lower(substr(COALESCE(NEW.sku,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.sku,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'object_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.object_code,''),position,1)),lower(substr(COALESCE(NEW.object_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.object_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'group_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.group_code,''),position,1)),lower(substr(COALESCE(NEW.group_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.group_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_parts_update AFTER UPDATE OF sku,name,object_code,group_code ON parts BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'sku',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.sku,''),position,1)),lower(substr(COALESCE(NEW.sku,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.sku,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'object_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.object_code,''),position,1)),lower(substr(COALESCE(NEW.object_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.object_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('parts',NEW.id,'group_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.group_code,''),position,1)),lower(substr(COALESCE(NEW.group_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.group_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_parts_delete AFTER DELETE ON parts BEGIN DELETE FROM catalog_search WHERE resource='parts' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'parts',t.id,'sku',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.sku,''),position,1)),lower(substr(COALESCE(t.sku,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.sku,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM parts t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'parts',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM parts t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'parts',t.id,'object_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.object_code,''),position,1)),lower(substr(COALESCE(t.object_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.object_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM parts t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'parts',t.id,'group_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.group_code,''),position,1)),lower(substr(COALESCE(t.group_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.group_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM parts t;
CREATE TRIGGER search_fuel_tanks_insert AFTER INSERT ON fuel_tanks BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('fuel-tanks',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('fuel-tanks',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('fuel-tanks',NEW.id,'location',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location,''),position,1)),lower(substr(COALESCE(NEW.location,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_fuel_tanks_update AFTER UPDATE OF code,name,location ON fuel_tanks BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('fuel-tanks',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('fuel-tanks',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('fuel-tanks',NEW.id,'location',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location,''),position,1)),lower(substr(COALESCE(NEW.location,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_fuel_tanks_delete AFTER DELETE ON fuel_tanks BEGIN DELETE FROM catalog_search WHERE resource='fuel-tanks' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'fuel-tanks',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM fuel_tanks t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'fuel-tanks',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM fuel_tanks t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'fuel-tanks',t.id,'location',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.location,''),position,1)),lower(substr(COALESCE(t.location,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.location,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM fuel_tanks t;
CREATE TRIGGER search_warehouses_insert AFTER INSERT ON warehouses BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('warehouses',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('warehouses',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('warehouses',NEW.id,'location',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location,''),position,1)),lower(substr(COALESCE(NEW.location,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_warehouses_update AFTER UPDATE OF code,name,location ON warehouses BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('warehouses',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('warehouses',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('warehouses',NEW.id,'location',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location,''),position,1)),lower(substr(COALESCE(NEW.location,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_warehouses_delete AFTER DELETE ON warehouses BEGIN DELETE FROM catalog_search WHERE resource='warehouses' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'warehouses',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM warehouses t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'warehouses',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM warehouses t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'warehouses',t.id,'location',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.location,''),position,1)),lower(substr(COALESCE(t.location,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.location,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM warehouses t;
CREATE TRIGGER search_vehicles_insert AFTER INSERT ON vehicles BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'plate_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.plate_number,''),position,1)),lower(substr(COALESCE(NEW.plate_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.plate_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'brand_model',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.brand_model,''),position,1)),lower(substr(COALESCE(NEW.brand_model,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.brand_model,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'chassis_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.chassis_number,''),position,1)),lower(substr(COALESCE(NEW.chassis_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.chassis_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'engine_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.engine_number,''),position,1)),lower(substr(COALESCE(NEW.engine_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.engine_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'lessor_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.lessor_name,''),position,1)),lower(substr(COALESCE(NEW.lessor_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.lessor_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'ownership_source',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.ownership_source,''),position,1)),lower(substr(COALESCE(NEW.ownership_source,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.ownership_source,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'route_group',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.route_group,''),position,1)),lower(substr(COALESCE(NEW.route_group,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.route_group,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'location_unit',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location_unit,''),position,1)),lower(substr(COALESCE(NEW.location_unit,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location_unit,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_vehicles_update AFTER UPDATE OF plate_number,brand_model,chassis_number,engine_number,lessor_name,ownership_source,route_group,location_unit ON vehicles BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'plate_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.plate_number,''),position,1)),lower(substr(COALESCE(NEW.plate_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.plate_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'brand_model',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.brand_model,''),position,1)),lower(substr(COALESCE(NEW.brand_model,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.brand_model,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'chassis_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.chassis_number,''),position,1)),lower(substr(COALESCE(NEW.chassis_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.chassis_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'engine_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.engine_number,''),position,1)),lower(substr(COALESCE(NEW.engine_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.engine_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'lessor_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.lessor_name,''),position,1)),lower(substr(COALESCE(NEW.lessor_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.lessor_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'ownership_source',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.ownership_source,''),position,1)),lower(substr(COALESCE(NEW.ownership_source,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.ownership_source,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'route_group',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.route_group,''),position,1)),lower(substr(COALESCE(NEW.route_group,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.route_group,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('vehicles',NEW.id,'location_unit',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.location_unit,''),position,1)),lower(substr(COALESCE(NEW.location_unit,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.location_unit,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_vehicles_delete AFTER DELETE ON vehicles BEGIN DELETE FROM catalog_search WHERE resource='vehicles' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'plate_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.plate_number,''),position,1)),lower(substr(COALESCE(t.plate_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.plate_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'brand_model',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.brand_model,''),position,1)),lower(substr(COALESCE(t.brand_model,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.brand_model,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'chassis_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.chassis_number,''),position,1)),lower(substr(COALESCE(t.chassis_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.chassis_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'engine_number',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.engine_number,''),position,1)),lower(substr(COALESCE(t.engine_number,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.engine_number,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'lessor_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.lessor_name,''),position,1)),lower(substr(COALESCE(t.lessor_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.lessor_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'ownership_source',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.ownership_source,''),position,1)),lower(substr(COALESCE(t.ownership_source,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.ownership_source,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'route_group',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.route_group,''),position,1)),lower(substr(COALESCE(t.route_group,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.route_group,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'vehicles',t.id,'location_unit',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.location_unit,''),position,1)),lower(substr(COALESCE(t.location_unit,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.location_unit,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM vehicles t;
CREATE TRIGGER search_org_units_insert AFTER INSERT ON org_units BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('org-units',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('org-units',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_org_units_update AFTER UPDATE OF code,name ON org_units BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('org-units',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('org-units',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_org_units_delete AFTER DELETE ON org_units BEGIN DELETE FROM catalog_search WHERE resource='org-units' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'org-units',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM org_units t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'org-units',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM org_units t;
CREATE TRIGGER search_departments_insert AFTER INSERT ON departments BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('departments',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('departments',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_departments_update AFTER UPDATE OF code,name ON departments BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('departments',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('departments',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_departments_delete AFTER DELETE ON departments BEGIN DELETE FROM catalog_search WHERE resource='departments' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'departments',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM departments t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'departments',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM departments t;
CREATE TRIGGER search_staff_insert AFTER INSERT ON staff BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'phone',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.phone,''),position,1)),lower(substr(COALESCE(NEW.phone,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.phone,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'email',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.email,''),position,1)),lower(substr(COALESCE(NEW.email,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.email,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'job_title',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.job_title,''),position,1)),lower(substr(COALESCE(NEW.job_title,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.job_title,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'department',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.department,''),position,1)),lower(substr(COALESCE(NEW.department,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.department,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'vehicle_plate',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.vehicle_plate,''),position,1)),lower(substr(COALESCE(NEW.vehicle_plate,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.vehicle_plate,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'trailer_plate',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.trailer_plate,''),position,1)),lower(substr(COALESCE(NEW.trailer_plate,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.trailer_plate,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_staff_update AFTER UPDATE OF code,name,phone,email,job_title,department,vehicle_plate,trailer_plate ON staff BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'phone',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.phone,''),position,1)),lower(substr(COALESCE(NEW.phone,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.phone,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'email',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.email,''),position,1)),lower(substr(COALESCE(NEW.email,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.email,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'job_title',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.job_title,''),position,1)),lower(substr(COALESCE(NEW.job_title,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.job_title,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'department',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.department,''),position,1)),lower(substr(COALESCE(NEW.department,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.department,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'vehicle_plate',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.vehicle_plate,''),position,1)),lower(substr(COALESCE(NEW.vehicle_plate,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.vehicle_plate,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('staff',NEW.id,'trailer_plate',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.trailer_plate,''),position,1)),lower(substr(COALESCE(NEW.trailer_plate,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.trailer_plate,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_staff_delete AFTER DELETE ON staff BEGIN DELETE FROM catalog_search WHERE resource='staff' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'phone',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.phone,''),position,1)),lower(substr(COALESCE(t.phone,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.phone,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'email',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.email,''),position,1)),lower(substr(COALESCE(t.email,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.email,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'job_title',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.job_title,''),position,1)),lower(substr(COALESCE(t.job_title,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.job_title,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'department',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.department,''),position,1)),lower(substr(COALESCE(t.department,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.department,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'vehicle_plate',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.vehicle_plate,''),position,1)),lower(substr(COALESCE(t.vehicle_plate,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.vehicle_plate,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'staff',t.id,'trailer_plate',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.trailer_plate,''),position,1)),lower(substr(COALESCE(t.trailer_plate,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.trailer_plate,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM staff t;
CREATE TRIGGER search_suppliers_insert AFTER INSERT ON suppliers BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'tax_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.tax_code,''),position,1)),lower(substr(COALESCE(NEW.tax_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.tax_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'province_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.province_name,''),position,1)),lower(substr(COALESCE(NEW.province_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.province_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'address',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.address,''),position,1)),lower(substr(COALESCE(NEW.address,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.address,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'supplied_items',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.supplied_items,''),position,1)),lower(substr(COALESCE(NEW.supplied_items,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.supplied_items,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_suppliers_update AFTER UPDATE OF code,name,tax_code,province_name,address,supplied_items ON suppliers BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.code,''),position,1)),lower(substr(COALESCE(NEW.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.name,''),position,1)),lower(substr(COALESCE(NEW.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'tax_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.tax_code,''),position,1)),lower(substr(COALESCE(NEW.tax_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.tax_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'province_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.province_name,''),position,1)),lower(substr(COALESCE(NEW.province_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.province_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'address',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.address,''),position,1)),lower(substr(COALESCE(NEW.address,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.address,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('suppliers',NEW.id,'supplied_items',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.supplied_items,''),position,1)),lower(substr(COALESCE(NEW.supplied_items,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.supplied_items,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_suppliers_delete AFTER DELETE ON suppliers BEGIN DELETE FROM catalog_search WHERE resource='suppliers' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'suppliers',t.id,'code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.code,''),position,1)),lower(substr(COALESCE(t.code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM suppliers t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'suppliers',t.id,'name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.name,''),position,1)),lower(substr(COALESCE(t.name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM suppliers t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'suppliers',t.id,'tax_code',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.tax_code,''),position,1)),lower(substr(COALESCE(t.tax_code,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.tax_code,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM suppliers t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'suppliers',t.id,'province_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.province_name,''),position,1)),lower(substr(COALESCE(t.province_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.province_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM suppliers t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'suppliers',t.id,'address',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.address,''),position,1)),lower(substr(COALESCE(t.address,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.address,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM suppliers t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'suppliers',t.id,'supplied_items',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.supplied_items,''),position,1)),lower(substr(COALESCE(t.supplied_items,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.supplied_items,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM suppliers t;
CREATE TRIGGER search_app_users_insert AFTER INSERT ON app_users BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('users',NEW.id,'email',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.email,''),position,1)),lower(substr(COALESCE(NEW.email,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.email,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('users',NEW.id,'display_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.display_name,''),position,1)),lower(substr(COALESCE(NEW.display_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.display_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_app_users_update AFTER UPDATE OF email,display_name ON app_users BEGIN
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('users',NEW.id,'email',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.email,''),position,1)),lower(substr(COALESCE(NEW.email,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.email,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
INSERT OR REPLACE INTO catalog_search(resource,entity_id,field_key,normalized_text) VALUES('users',NEW.id,'display_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(NEW.display_name,''),position,1)),lower(substr(COALESCE(NEW.display_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(NEW.display_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1));
END;
CREATE TRIGGER search_app_users_delete AFTER DELETE ON app_users BEGIN DELETE FROM catalog_search WHERE resource='users' AND entity_id=OLD.id; END;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'users',t.id,'email',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.email,''),position,1)),lower(substr(COALESCE(t.email,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.email,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM app_users t;
INSERT INTO catalog_search(resource,entity_id,field_key,normalized_text) SELECT 'users',t.id,'display_name',(WITH RECURSIVE folded(position,result) AS (VALUES(1,'') UNION ALL SELECT position+1,result||COALESCE((SELECT normalized FROM search_character_map WHERE character=substr(COALESCE(t.display_name,''),position,1)),lower(substr(COALESCE(t.display_name,''),position,1))) FROM folded WHERE position<=length(COALESCE(t.display_name,''))) SELECT result FROM folded ORDER BY position DESC LIMIT 1) FROM app_users t;
