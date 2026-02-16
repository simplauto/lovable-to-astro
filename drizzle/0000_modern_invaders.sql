CREATE TABLE `conversions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commit_sha` text NOT NULL,
	`commit_message` text,
	`branch` text DEFAULT 'main',
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversion_id` integer NOT NULL,
	`component_path` text NOT NULL,
	`question_text` text NOT NULL,
	`context` text,
	`answer` text,
	`answered_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversion_id`) REFERENCES `conversions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_path` text NOT NULL,
	`mode` text NOT NULL,
	`hydration_directive` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rules_component_path_unique` ON `rules` (`component_path`);