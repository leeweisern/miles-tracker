CREATE TABLE `award_flights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`flight_number` text NOT NULL,
	`departure_date` text NOT NULL,
	`departure_time` text NOT NULL,
	`arrival_time` text NOT NULL,
	`arrival_day_offset` integer DEFAULT 0 NOT NULL,
	`duration_minutes` integer NOT NULL,
	`route_type` text NOT NULL,
	`cabin` text NOT NULL,
	`tier` text NOT NULL,
	`points` integer NOT NULL,
	`available` integer DEFAULT 1 NOT NULL,
	`seats_left` integer,
	`taxes_myr` real NOT NULL,
	`cash_equivalent_myr` real,
	`notes` text,
	`scraped_at` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_flights_route_date` ON `award_flights` (`origin`,`destination`,`departure_date`);--> statement-breakpoint
CREATE INDEX `idx_flights_program_date` ON `award_flights` (`program_id`,`departure_date`);--> statement-breakpoint
CREATE INDEX `idx_flights_destination` ON `award_flights` (`destination`,`departure_date`,`cabin`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_flight_route_date_cabin_tier` ON `award_flights` (`program_id`,`origin`,`destination`,`flight_number`,`departure_date`,`cabin`,`tier`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`airline` text NOT NULL,
	`alliance` text,
	`created_at` text DEFAULT (datetime('now'))
);
