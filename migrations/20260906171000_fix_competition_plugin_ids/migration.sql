UPDATE `placements`
SET `plugin_id` = CASE `plugin_id`
	WHEN 'radio-atlas' THEN 'akshar.radio-atlas'
	WHEN 'omagotchi' THEN 'slcode777.omagotchi'
	WHEN 'airpods' THEN 'io.github.thisisgm.omapods'
	ELSE `plugin_id`
END
WHERE `plugin_id` IN ('radio-atlas', 'omagotchi', 'airpods');
