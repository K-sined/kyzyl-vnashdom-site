-- Заявки с квиза сайта kyzyl.vnashdom.ru. Импортируется один раз через phpMyAdmin.
-- Можно в ту же базу, что и приложение розыгрыша: таблица называется по-своему.

CREATE TABLE IF NOT EXISTS site_leads (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(30)  NOT NULL,
  room        VARCHAR(100) NULL,
  materials   VARCHAR(300) NULL,
  timing      VARCHAR(100) NULL,
  need_calc   VARCHAR(100) NULL,
  source      VARCHAR(100) NULL,             -- с какого зеркала пришла заявка
  consent_pd  TINYINT(1)   NOT NULL,         -- согласие на обработку ПДн отмечено
  ip_hash     CHAR(64)     NULL,
  created_at  DATETIME     NOT NULL,
  INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
