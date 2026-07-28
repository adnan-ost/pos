-- Demo/dummy orders for Reports & Orders screens
-- Safe to re-run: only inserts, does not touch menu_items/categories/customers.
-- Uses item names/prices matching the existing menu_items seed data.
-- Requires waiters_migration.sql to have been run first (waiter_id/waiter_name
-- columns + demo staff), otherwise every ticket falls back to "Unassigned".

INSERT INTO orders (order_number, items, subtotal, tax, total, status, customer_name, customer_phone, order_type, table_number, notes, waiter_id, waiter_name, created_at) VALUES

-- Today
('100234', '[{"name":"Chicken Karahi","price":1200,"qty":1},{"name":"Roghni Naan","price":80,"qty":3},{"name":"Kashmiri Chai","price":180,"qty":2}]', 1800, 288, 2088, 'completed', NULL, NULL, 'dine-in', 'T4', NULL, (SELECT id FROM waiters WHERE code = 'W-01'), 'Ahmed Raza', now() - interval '2 hours'),
('100235', '[{"name":"Chapli Kabab","price":450,"qty":2},{"name":"Mineral Water","price":80,"qty":2}]', 1060, 170, 1230, 'ready', 'Bilal Ahmed', '03001234567', 'takeaway', NULL, NULL, (SELECT id FROM waiters WHERE code = 'W-02'), 'Bilal Hussain', now() - interval '1 hour'),
('100236', '[{"name":"Mutton Karahi","price":2200,"qty":1},{"name":"Paratha","price":60,"qty":4}]', 2440, 390, 2830, 'preparing', NULL, NULL, 'dine-in', 'T2', NULL, (SELECT id FROM waiters WHERE code = 'W-03'), 'Danish Iqbal', now() - interval '30 minutes'),
('100237', '[{"name":"Seekh Kabab","price":400,"qty":3},{"name":"Gol Gappay","price":150,"qty":1}]', 1350, 216, 1566, 'new', 'Sara Khan', '03211239876', 'delivery', NULL, 'Ring the bell twice', NULL, NULL, now() - interval '10 minutes'),

-- Yesterday
('100221', '[{"name":"Chicken Handi","price":1400,"qty":1},{"name":"Roghni Naan","price":80,"qty":2},{"name":"Gulab Jamun","price":200,"qty":1}]', 1760, 282, 2042, 'completed', NULL, NULL, 'dine-in', 'T1', NULL, (SELECT id FROM waiters WHERE code = 'W-04'), 'Faisal Khan', now() - interval '1 day 3 hours'),
('100222', '[{"name":"Daal Makhni","price":650,"qty":1},{"name":"Tandoori Roti","price":40,"qty":4}]', 810, 130, 940, 'completed', 'Usman Tariq', '03451112233', 'takeaway', NULL, NULL, (SELECT id FROM waiters WHERE code = 'W-05'), 'Hamza Tariq', now() - interval '1 day 5 hours'),
('100223', '[{"name":"Beef Nihari","price":700,"qty":2},{"name":"Kashmiri Chai","price":180,"qty":2}]', 1760, 282, 2042, 'cancelled', NULL, NULL, 'dine-in', 'T6', 'Customer left', (SELECT id FROM waiters WHERE code = 'W-06'), 'Usman Ghani', now() - interval '1 day 7 hours'),

-- 3 days ago
('100198', '[{"name":"Chicken Badami Qorma","price":1000,"qty":1},{"name":"Roghni Naan","price":80,"qty":3},{"name":"Zarda","price":250,"qty":1}]', 1580, 253, 1833, 'completed', NULL, NULL, 'dine-in', 'T3', NULL, (SELECT id FROM waiters WHERE code = 'W-07'), 'Ali Hassan', now() - interval '3 days 2 hours'),
('100199', '[{"name":"Russian Salad","price":200,"qty":2},{"name":"Chicken Jalfrezi","price":850,"qty":1},{"name":"Paratha","price":60,"qty":2}]', 1370, 219, 1589, 'completed', 'Ayesha Malik', '03331239988', 'delivery', NULL, NULL, NULL, NULL, now() - interval '3 days 6 hours'),

-- 5 days ago
('100167', '[{"name":"Mutton Haleem","price":700,"qty":2},{"name":"Shahi Tukray","price":280,"qty":1}]', 1680, 269, 1949, 'completed', NULL, NULL, 'takeaway', NULL, NULL, (SELECT id FROM waiters WHERE code = 'W-08'), 'Zain Abbas', now() - interval '5 days 4 hours'),
('100168', '[{"name":"Chicken Karahi","price":1200,"qty":2},{"name":"Roghni Naan","price":80,"qty":4},{"name":"Ras Malai","price":350,"qty":2}]', 3420, 547, 3967, 'completed', NULL, NULL, 'dine-in', 'T5', NULL, (SELECT id FROM waiters WHERE code = 'W-09'), 'Saad Malik', now() - interval '5 days 8 hours'),

-- ~1.5 weeks ago (for 30-day view)
('100120', '[{"name":"Hot & Sour Soup","price":250,"qty":2},{"name":"Chicken Handi","price":1400,"qty":1}]', 1900, 304, 2204, 'completed', 'Hamza Sheikh', '03005556677', 'delivery', NULL, NULL, (SELECT id FROM waiters WHERE code = 'W-10'), 'Kashif Nawaz', now() - interval '9 days 3 hours'),
('100121', '[{"name":"Beef Haleem","price":550,"qty":1},{"name":"Tandoori Roti","price":40,"qty":3}]', 670, 107, 777, 'completed', NULL, NULL, 'takeaway', NULL, NULL, (SELECT id FROM waiters WHERE code = 'W-11'), 'Waqas Ahmed', now() - interval '11 days 5 hours'),

-- ~3 weeks ago
('100085', '[{"name":"Mutton Karahi","price":2200,"qty":1},{"name":"Roghni Naan","price":80,"qty":3},{"name":"Kashmiri Chai","price":180,"qty":3}]', 2980, 477, 3457, 'completed', NULL, NULL, 'dine-in', 'T2', NULL, (SELECT id FROM waiters WHERE code = 'W-12'), 'Fahad Sheikh', now() - interval '20 days 6 hours'),
('100086', '[{"name":"Chicken Qorma","price":900,"qty":1},{"name":"Paratha","price":60,"qty":3},{"name":"Gulab Jamun","price":200,"qty":2}]', 1480, 237, 1717, 'completed', 'Fatima Noor', '03219998877', 'delivery', NULL, NULL, NULL, NULL, now() - interval '25 days 2 hours');
