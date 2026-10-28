-- Province is optional; populated values still reference vietnam_provinces.
DROP TRIGGER supplier_rules_insert;
DROP TRIGGER supplier_rules_update;
CREATE TRIGGER supplier_rules_insert BEFORE INSERT ON suppliers WHEN length(NEW.code)!=8 OR NEW.code NOT GLOB 'NCC[0-9][0-9][0-9][0-9][0-9]' OR substr(NEW.code,4)='00000' BEGIN SELECT RAISE(ABORT,'SUPPLIER_INVALID_FIELDS'); END;
CREATE TRIGGER supplier_rules_update BEFORE UPDATE OF code ON suppliers WHEN NEW.code!=OLD.code AND (length(NEW.code)!=8 OR NEW.code NOT GLOB 'NCC[0-9][0-9][0-9][0-9][0-9]' OR substr(NEW.code,4)='00000') BEGIN SELECT RAISE(ABORT,'SUPPLIER_INVALID_FIELDS'); END;
