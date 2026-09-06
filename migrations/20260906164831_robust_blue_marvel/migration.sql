CREATE TABLE `competitions` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`announced_at` text NOT NULL,
	`announcement_url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `placements` (
	`competition_id` text NOT NULL,
	`plugin_id` text NOT NULL,
	`place` integer NOT NULL,
	`prize` integer,
	CONSTRAINT `fk_placements_competition_id_competitions_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`)
);
--> statement-breakpoint
CREATE INDEX `placements_plugin_idx` ON `placements` (`plugin_id`);
--> statement-breakpoint
INSERT INTO `competitions` (`id`, `title`, `announced_at`, `announcement_url`) VALUES
	('comp-01', 'The First Plugin Competition', '2026-08-28', 'https://omarchy.org/news/2026/08/the-first-plugin-competition-winners/');
--> statement-breakpoint
INSERT INTO `placements` (`competition_id`, `plugin_id`, `place`, `prize`) VALUES
	('comp-01', 'radio-atlas', 1, 2500),
	('comp-01', 'omagotchi', 2, 1000),
	('comp-01', 'airpods', 3, 500),
	('comp-01', 'robzolkos.github', 0, NULL);
