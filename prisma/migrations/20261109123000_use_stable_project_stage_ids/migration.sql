-- Store stable workflow identifiers, not presentation labels. Existing project
-- history is preserved by translating only the known legacy labels.
UPDATE "Project" SET "stage" = CASE "stage"
  WHEN 'Advance recorded (demo)' THEN 'ADVANCE_RECORDED'
  WHEN 'Site survey complete' THEN 'SITE_SURVEY_COMPLETE'
  WHEN 'Installation scheduled' THEN 'INSTALLATION_SCHEDULED'
  WHEN 'Installed' THEN 'INSTALLED'
  WHEN 'Net-metering submitted' THEN 'NET_METERING_SUBMITTED'
  WHEN 'Commissioned' THEN 'COMMISSIONED'
  WHEN 'Subsidy credited' THEN 'SUBSIDY_CREDITED'
  ELSE "stage"
END;

UPDATE "StageEvent" SET "stage" = CASE "stage"
  WHEN 'Advance recorded (demo)' THEN 'ADVANCE_RECORDED'
  WHEN 'Site survey complete' THEN 'SITE_SURVEY_COMPLETE'
  WHEN 'Installation scheduled' THEN 'INSTALLATION_SCHEDULED'
  WHEN 'Installed' THEN 'INSTALLED'
  WHEN 'Net-metering submitted' THEN 'NET_METERING_SUBMITTED'
  WHEN 'Commissioned' THEN 'COMMISSIONED'
  WHEN 'Subsidy credited' THEN 'SUBSIDY_CREDITED'
  ELSE "stage"
END;
