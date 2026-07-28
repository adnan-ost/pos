-- Demo tickets for the Kitchen Display System (/kds)
-- Only creates ACTIVE orders (new / preparing / ready) so they appear on the board.
-- Ages are staggered to demo the urgency colours:
--   under 5 min = normal, 5-10 min = amber, over 10 min = red.
-- Re-runnable: clears prior demo tickets by order_number before inserting.

DELETE FROM orders WHERE order_number LIKE 'K1%';

INSERT INTO orders (order_number, items, subtotal, tax, total, status, customer_name, customer_phone, order_type, table_number, notes, created_at) VALUES

-- ===== NEW (freshly fired) =====
('K101', '[{"name":"Chicken Karahi","price":1200,"qty":2,"selectedModifiers":{"spiciness":{"name":"Extra Spicy","price":0}}},{"name":"Roghni Naan","price":80,"qty":4}]', 2720, 435, 3155, 'new', NULL, NULL, 'dine-in', 'T7', 'No green chilli - allergy', now() - interval '45 seconds'),
('K102', '[{"name":"Seekh Kabab","price":400,"qty":3},{"name":"Kashmiri Chai","price":180,"qty":2}]', 1560, 250, 1810, 'new', 'Imran Yousaf', '03007894561', 'takeaway', NULL, NULL, now() - interval '2 minutes'),
('K103', '[{"name":"Chicken Handi","price":1400,"qty":1},{"name":"Paratha","price":60,"qty":3},{"name":"Mineral Water","price":80,"qty":2}]', 1740, 278, 2018, 'new', NULL, NULL, 'dine-in', 'T3', NULL, now() - interval '4 minutes'),
('K104', '[{"name":"Gol Gappay","price":150,"qty":2},{"name":"Russian Salad","price":200,"qty":1}]', 500, 80, 580, 'new', 'Nida Aslam', '03331472583', 'delivery', NULL, 'Extra tamarind water on the side', now() - interval '6 minutes'),

-- ===== PREPARING (on the range) =====
('K105', '[{"name":"Mutton Karahi","price":2200,"qty":1,"selectedModifiers":{"spiciness":{"name":"Medium","price":0}}},{"name":"Tandoori Roti","price":40,"qty":5}]', 2400, 384, 2784, 'preparing', NULL, NULL, 'dine-in', 'T1', NULL, now() - interval '3 minutes'),
('K106', '[{"name":"Beef Nihari","price":700,"qty":2},{"name":"Roghni Naan","price":80,"qty":4}]', 1720, 275, 1995, 'preparing', NULL, NULL, 'dine-in', 'T9', 'Extra nihari masala', now() - interval '7 minutes'),
('K107', '[{"name":"Chicken Jalfrezi","price":850,"qty":1},{"name":"Hot & Sour Soup","price":250,"qty":2},{"name":"Paratha","price":60,"qty":2}]', 1470, 235, 1705, 'preparing', 'Zeeshan Ali', '03215554433', 'takeaway', NULL, NULL, now() - interval '9 minutes'),
('K108', '[{"name":"Chicken Badami Qorma","price":1000,"qty":2},{"name":"Zarda","price":250,"qty":2}]', 2500, 400, 2900, 'preparing', NULL, NULL, 'dine-in', 'T5', NULL, now() - interval '13 minutes'),
('K109', '[{"name":"Mutton Haleem","price":700,"qty":3},{"name":"Kashmiri Chai","price":180,"qty":3}]', 2640, 422, 3062, 'preparing', 'Kashif Mehmood', '03009998877', 'delivery', NULL, 'Rider waiting downstairs', now() - interval '18 minutes'),

-- ===== READY (waiting on the pass) =====
('K110', '[{"name":"Chapli Kabab","price":450,"qty":4},{"name":"Tandoori Roti","price":40,"qty":4}]', 1960, 314, 2274, 'ready', NULL, NULL, 'dine-in', 'T2', NULL, now() - interval '5 minutes'),
('K111', '[{"name":"Daal Makhni","price":650,"qty":1},{"name":"Chicken Qorma","price":900,"qty":1},{"name":"Roghni Naan","price":80,"qty":3}]', 1790, 286, 2076, 'ready', 'Hira Baig', '03451239874', 'takeaway', NULL, NULL, now() - interval '8 minutes'),
('K112', '[{"name":"Beef Haleem","price":550,"qty":2},{"name":"Gulab Jamun","price":200,"qty":2},{"name":"Ras Malai","price":350,"qty":1}]', 1850, 296, 2146, 'ready', NULL, NULL, 'dine-in', 'T6', NULL, now() - interval '12 minutes'),
('K113', '[{"name":"Shahi Tukray","price":280,"qty":2},{"name":"Kashmiri Chai","price":180,"qty":2}]', 920, 147, 1067, 'ready', 'Owais Rehman', '03337776655', 'delivery', NULL, 'Ring bell twice', now() - interval '22 minutes');
