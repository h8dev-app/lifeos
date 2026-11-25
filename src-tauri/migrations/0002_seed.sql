-- Initial categories. Fixed ids so every machine shares them (future sync).
-- fields_schema format: see src/lib/parsing/schema.ts

INSERT INTO categories (id, slug, name, icon, color, fields_schema, is_system, created_at, updated_at) VALUES
('00000000-0000-4000-8000-000000000001', 'sport', 'Sport', '🏃', '#4ade80',
 '{"fields":[{"key":"activity","label":"Activité","type":"text","take":"rest"},{"key":"distance_km","label":"Distance","type":"distance"},{"key":"duration_min","label":"Durée","type":"duration"}]}',
 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
('00000000-0000-4000-8000-000000000002', 'devoirs', 'Devoirs', '📚', '#60a5fa',
 '{"fields":[{"key":"subject","label":"Matière","type":"text","take":"word"},{"key":"duration_min","label":"Durée","type":"duration"},{"key":"note","label":"Note","type":"text","take":"rest"}]}',
 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
('00000000-0000-4000-8000-000000000003', 'cuisine', 'Cuisine', '🍳', '#fbbf24',
 '{"fields":[{"key":"dish","label":"Plat","type":"text","take":"rest"}]}',
 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
('00000000-0000-4000-8000-000000000004', 'commande', 'Commandes', '🛵', '#f87171',
 '{"fields":[{"key":"service","label":"Service","type":"text","take":"rest"},{"key":"amount_eur","label":"Montant","type":"money"}]}',
 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
('00000000-0000-4000-8000-000000000005', 'code', 'Code', '💻', '#a78bfa',
 '{"fields":[{"key":"repo","label":"Dépôt","type":"text","take":"word"},{"key":"commits","label":"Commits","type":"number","unit":"commits"}]}',
 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
