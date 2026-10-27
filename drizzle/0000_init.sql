CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Account_userId_idx` ON `Account` (`userId`);--> statement-breakpoint
CREATE TABLE `Bike` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`typeCode` text DEFAULT '' NOT NULL,
	`plate` text DEFAULT '' NOT NULL,
	`vin` text DEFAULT '' NOT NULL,
	`firstRegistration` text,
	`powerKw` integer,
	`displacementCcm` integer,
	`fuel` text DEFAULT '' NOT NULL,
	`conditions` text DEFAULT '' NOT NULL,
	`insurer` text DEFAULT '' NOT NULL,
	`policyNumber` text DEFAULT '' NOT NULL,
	`liabilityCapEur` integer DEFAULT 1000 NOT NULL,
	`photoPath` text,
	`lendable` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Bike_ownerId_idx` ON `Bike` (`ownerId`);--> statement-breakpoint
CREATE TABLE `category` (
	`slug` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`listingId` text NOT NULL,
	`buyerId` text NOT NULL,
	`sellerId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`lastMessageAt` integer NOT NULL,
	FOREIGN KEY (`listingId`) REFERENCES `listing`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sellerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_listing_buyer_idx` ON `conversation` (`listingId`,`buyerId`);--> statement-breakpoint
CREATE INDEX `conversation_buyerId_idx` ON `conversation` (`buyerId`);--> statement-breakpoint
CREATE INDEX `conversation_sellerId_idx` ON `conversation` (`sellerId`);--> statement-breakpoint
CREATE TABLE `listing` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`categorySlug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priceKind` text DEFAULT 'kostenlos' NOT NULL,
	`priceCents` integer,
	`zip` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`country` text DEFAULT 'DE' NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`bikeId` text,
	`searchText` text DEFAULT '' NOT NULL,
	`cityKey` text DEFAULT '' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categorySlug`) REFERENCES `category`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bikeId`) REFERENCES `Bike`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listing_status_createdAt_idx` ON `listing` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `listing_categorySlug_idx` ON `listing` (`categorySlug`);--> statement-breakpoint
CREATE INDEX `listing_city_idx` ON `listing` (`city`);--> statement-breakpoint
CREATE INDEX `listing_cityKey_idx` ON `listing` (`cityKey`);--> statement-breakpoint
CREATE INDEX `listing_userId_idx` ON `listing` (`userId`);--> statement-breakpoint
CREATE TABLE `listing_photo` (
	`id` text PRIMARY KEY NOT NULL,
	`listingId` text NOT NULL,
	`key` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listingId`) REFERENCES `listing`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listing_photo_listingId_idx` ON `listing_photo` (`listingId`,`sort`);--> statement-breakpoint
CREATE TABLE `Loan` (
	`id` text PRIMARY KEY NOT NULL,
	`bikeId` text NOT NULL,
	`lenderId` text NOT NULL,
	`listingId` text,
	`conversationId` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`borrowerName` text DEFAULT '' NOT NULL,
	`borrowerStreet` text DEFAULT '' NOT NULL,
	`borrowerZipCity` text DEFAULT '' NOT NULL,
	`borrowerBirthdate` text,
	`borrowerPhone` text DEFAULT '' NOT NULL,
	`licenseNumber` text DEFAULT '' NOT NULL,
	`licenseClassASince` text DEFAULT '' NOT NULL,
	`startDate` text,
	`startTime` text,
	`endMode` text DEFAULT 'open' NOT NULL,
	`endDate` text,
	`endTime` text,
	`latestEndDate` text,
	`returnPlace` text DEFAULT '' NOT NULL,
	`liabilityCapEur` integer DEFAULT 1000 NOT NULL,
	`handedOverItems` text DEFAULT '{"keys":true,"keyCount":1,"registration":true,"other":""}' NOT NULL,
	`placeDate` text DEFAULT '' NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`bikeId`) REFERENCES `Bike`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lenderId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listingId`) REFERENCES `listing`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Loan_bikeId_status_idx` ON `Loan` (`bikeId`,`status`);--> statement-breakpoint
CREATE INDEX `Loan_lenderId_idx` ON `Loan` (`lenderId`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`senderId` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` integer NOT NULL,
	`readAt` integer,
	FOREIGN KEY (`conversationId`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_conversationId_createdAt_idx` ON `message` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `Photo` (
	`id` text PRIMARY KEY NOT NULL,
	`protocolId` text NOT NULL,
	`path` text NOT NULL,
	`takenAt` integer NOT NULL,
	FOREIGN KEY (`protocolId`) REFERENCES `Protocol`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `Photo_protocolId_idx` ON `Photo` (`protocolId`);--> statement-breakpoint
CREATE TABLE `Profile` (
	`userId` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`zipCity` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`birthdate` text,
	`licenseNumber` text DEFAULT '' NOT NULL,
	`licenseClassASince` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Protocol` (
	`id` text PRIMARY KEY NOT NULL,
	`loanId` text NOT NULL,
	`kind` text NOT NULL,
	`datetime` text,
	`odometerKm` integer,
	`fuelLevel` text DEFAULT '' NOT NULL,
	`damages` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Protocol_loanId_kind_idx` ON `Protocol` (`loanId`,`kind`);--> statement-breakpoint
CREATE TABLE `saved_listing` (
	`userId` text NOT NULL,
	`listingId` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `listingId`),
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listingId`) REFERENCES `listing`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_token_unique` ON `Session` (`token`);--> statement-breakpoint
CREATE INDEX `Session_userId_idx` ON `Session` (`userId`);--> statement-breakpoint
CREATE TABLE `Signature` (
	`id` text PRIMARY KEY NOT NULL,
	`loanId` text NOT NULL,
	`role` text NOT NULL,
	`pngDataUrl` text NOT NULL,
	FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Signature_loanId_role_idx` ON `Signature` (`loanId`,`role`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `Verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
