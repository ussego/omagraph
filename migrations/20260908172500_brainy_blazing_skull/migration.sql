CREATE TABLE `submission_events` (
	`issue_number` integer PRIMARY KEY,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_events_time_idx` ON `submission_events` (`occurred_at`);