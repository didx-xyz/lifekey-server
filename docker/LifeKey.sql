CREATE DATABASE IF NOT EXISTS `lifekey`;
USE `lifekey`;
-- MySQL dump 10.13  Distrib 5.7.17, for macos10.12 (x86_64)
--
-- Host: 35.187.24.243    Database: lifekey
-- ------------------------------------------------------
-- Server version	5.7.14-google-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED='fcc180ab-f2a0-11e6-b7b5-42010af00303:1-58591333';

--
-- Table structure for table `active_bots`
--

DROP TABLE IF EXISTS `active_bots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `active_bots` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `last_ping` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owner_id` (`owner_id`)
) ENGINE=InnoDB AUTO_INCREMENT=293267 DEFAULT CHARSET=utf8 COMMENT='liveness checking for bot users';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `crypto_keys`
--

DROP TABLE IF EXISTS `crypto_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crypto_keys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `algorithm` varchar(255) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `alias` varchar(255) NOT NULL,
  `private_key` blob,
  `public_key` blob,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1694 DEFAULT CHARSET=utf8 COMMENT='crypto keys for users or agents';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dropped_messages`
--

DROP TABLE IF EXISTS `dropped_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dropped_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `contents` text NOT NULL,
  `dropped_at` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=235 DEFAULT CHARSET=utf8 COMMENT='dropped messages for lazy retrieval';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `facial_verifications`
--

DROP TABLE IF EXISTS `facial_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `facial_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `verifier_did` varchar(255) DEFAULT NULL,
  `subject_did` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `result` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  UNIQUE KEY `facial_verifications_token_unique` (`token`)
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=utf8 COMMENT='facial verification records';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `http_request_verifications`
--

DROP TABLE IF EXISTS `http_request_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `http_request_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `public_key` text NOT NULL,
  `algorithm` varchar(255) NOT NULL,
  `plaintext` text NOT NULL,
  `signature` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `where_index_1` (`algorithm`(20),`signature`(50)) USING BTREE,
  KEY `where_index_2` (`public_key`(50),`algorithm`,`signature`(50),`plaintext`(50)) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1412885 DEFAULT CHARSET=utf8 COMMENT='signatures from web requests for posterity';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `information_sharing_agreement_receipts`
--

DROP TABLE IF EXISTS `information_sharing_agreement_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `information_sharing_agreement_receipts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isar_id` int(11) NOT NULL,
  `isa_id` int(11) NOT NULL,
  `receipt` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `isar_id` (`isar_id`),
  UNIQUE KEY `isa_id` (`isa_id`),
  UNIQUE KEY `information_sharing_agreement_recepits_isar_id_unique` (`isar_id`),
  UNIQUE KEY `information_sharing_agreement_recepits_isa_id_unique` (`isa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='information sharing agreements';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `information_sharing_agreement_requests`
--

DROP TABLE IF EXISTS `information_sharing_agreement_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `information_sharing_agreement_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_did` varchar(255) NOT NULL,
  `to_did` varchar(255) NOT NULL,
  `action_id` int(11) DEFAULT NULL,
  `acknowledged` tinyint(1) DEFAULT NULL,
  `optional_entities` text,
  `required_entities` text NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `license` varchar(255) DEFAULT NULL,
  `accepted` tinyint(1) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=983 DEFAULT CHARSET=utf8 COMMENT='information sharing agreements in jsonld format';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `information_sharing_agreements`
--

DROP TABLE IF EXISTS `information_sharing_agreements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `information_sharing_agreements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isar_id` int(11) NOT NULL,
  `from_did` varchar(255) NOT NULL,
  `to_did` varchar(255) NOT NULL,
  `expired` tinyint(1) DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `transaction_hash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `isar_id` (`isar_id`),
  UNIQUE KEY `information_sharing_agreements_isar_id_unique` (`isar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=673 DEFAULT CHARSET=utf8 COMMENT='information sharing agreements';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `information_sharing_permissions`
--

DROP TABLE IF EXISTS `information_sharing_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `information_sharing_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isa_id` int(11) NOT NULL,
  `user_datum_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2389 DEFAULT CHARSET=utf8 COMMENT='information sharing agreements';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `isa_receipt_transactions`
--

DROP TABLE IF EXISTS `isa_receipt_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `isa_receipt_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isa_id` int(11) NOT NULL,
  `receipt_hash` varchar(255) NOT NULL,
  `transaction_hash` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `isa_id_UNIQUE` (`isa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=565 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sms_verifications`
--

DROP TABLE IF EXISTS `sms_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `user_datum_id` int(11) NOT NULL,
  `otp` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `otp_UNIQUE` (`otp`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_action_logs`
--

DROP TABLE IF EXISTS `user_action_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_action_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_id` int(11) NOT NULL,
  `to_id` int(11) NOT NULL,
  `object_type` varchar(255) NOT NULL,
  `action` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='event logs';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_actions`
--

DROP TABLE IF EXISTS `user_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `license` varchar(255) NOT NULL,
  `entities` text NOT NULL,
  `optional_entities` text,
  `duration_days` int(11) DEFAULT '365',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8 COMMENT='crypto keys for users or agents';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_connection_requests`
--

DROP TABLE IF EXISTS `user_connection_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_connection_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_did` varchar(255) NOT NULL,
  `to_did` varchar(255) NOT NULL,
  `acknowledged` tinyint(1) DEFAULT NULL,
  `accepted` tinyint(1) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=480 DEFAULT CHARSET=utf8 COMMENT='graph relation for users or agents';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_connections`
--

DROP TABLE IF EXISTS `user_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_connections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_did` varchar(255) NOT NULL,
  `to_did` varchar(255) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=660 DEFAULT CHARSET=utf8 COMMENT='graph relation for users or agents';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_data`
--

DROP TABLE IF EXISTS `user_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `entity` varchar(255) NOT NULL,
  `attribute` varchar(255) NOT NULL,
  `value` mediumblob NOT NULL,
  `schema` varchar(255) DEFAULT NULL,
  `uri` varchar(255) DEFAULT NULL,
  `mime` varchar(255) NOT NULL DEFAULT 'text/plain',
  `from_user_did` varchar(255) DEFAULT NULL,
  `from_resource_name` varchar(255) DEFAULT NULL,
  `from_resource_description` varchar(255) DEFAULT NULL,
  `is_verifiable_claim` tinyint(1) DEFAULT '0',
  `encoding` varchar(255) DEFAULT 'utf8',
  `alias` varchar(255) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5763872 DEFAULT CHARSET=utf8 COMMENT='data associated with end users';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_devices`
--

DROP TABLE IF EXISTS `user_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) NOT NULL,
  `platform` varchar(255) NOT NULL,
  `device_id` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owner_id` (`owner_id`),
  UNIQUE KEY `user_devices_owner_id_unique` (`owner_id`)
) ENGINE=InnoDB AUTO_INCREMENT=545 DEFAULT CHARSET=utf8 COMMENT='push notification destinations for users';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `did` varchar(255) DEFAULT NULL,
  `did_address` varchar(255) DEFAULT NULL,
  `nickname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `webhook_url` varchar(255) DEFAULT NULL,
  `actions_url` varchar(255) DEFAULT NULL,
  `display_name` text,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_tel` varchar(255) DEFAULT NULL,
  `contact_address` text,
  `branding_image_uri` text,
  `branding_colour_code` varchar(255) DEFAULT '#1A7BFF',
  `app_activation_code` varchar(255) NOT NULL,
  `app_activation_link_clicked` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `host_address` varchar(255) DEFAULT NULL,
  `web_auth_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `did` (`did`),
  UNIQUE KEY `did_address` (`did_address`),
  UNIQUE KEY `webhook_url` (`webhook_url`),
  UNIQUE KEY `actions_url` (`actions_url`),
  UNIQUE KEY `users_did_unique` (`did`),
  UNIQUE KEY `users_did_address_unique` (`did_address`),
  UNIQUE KEY `users_webhook_url_unique` (`webhook_url`),
  UNIQUE KEY `users_actions_url_unique` (`actions_url`),
  UNIQUE KEY `web_auth_url_UNIQUE` (`web_auth_url`)
) ENGINE=InnoDB AUTO_INCREMENT=810 DEFAULT CHARSET=utf8 COMMENT='end users';
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2018-07-13 13:50:36
