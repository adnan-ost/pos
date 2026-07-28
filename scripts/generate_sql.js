const fs = require('fs');
const path = require('path');

// 1. Read menuData.js and convert to CJS
const menuDataPath = path.join(process.cwd(), 'src', 'lib', 'menuData.js');
let content = fs.readFileSync(menuDataPath, 'utf8');

// Simple conversion: remove imports and change export to module.exports
content = content.replace(/import.*?from.*?;/g, '');
content = content.replace('export const menuData =', 'const menuData =');
content += '\nmodule.exports = { menuData };';

const tempCjsPath = path.join(process.cwd(), 'temp_menuData.cjs');
fs.writeFileSync(tempCjsPath, content);

// 2. Require the converted data
const { menuData } = require(tempCjsPath);

const finalSql = [];

// 3. Header
finalSql.push('-- SQL Seed Data for Flames by the Indus');
finalSql.push('-- Generated based on src/lib/menuData.js');
finalSql.push('');

// 4. Cleanup
finalSql.push('-- Clear existing data');
finalSql.push('TRUNCATE menu_items, categories, modifiers CASCADE;');
finalSql.push('');

// 5. Temporary table for ID mapping
finalSql.push('-- Temporary table for category ID mapping during the script');
finalSql.push('CREATE TEMPORARY TABLE temp_cat (id UUID, name TEXT);');
finalSql.push('');

// 6. Insert Categories
finalSql.push('-- Insert Categories');
menuData.categories.forEach((cat, index) => {
    finalSql.push(`WITH inserted AS (INSERT INTO categories (name, icon, sort_order) VALUES ('${cat.name.replace(/'/g, "''")}', '${cat.icon}', ${index}) RETURNING id) INSERT INTO temp_cat (id, name) SELECT id, '${cat.name.replace(/'/g, "''")}' FROM inserted;`);
});
finalSql.push('');

// 7. Insert Modifiers
finalSql.push('-- Insert Modifiers');
for (const [key, mod] of Object.entries(menuData.modifiers)) {
    finalSql.push(`INSERT INTO modifiers (key, name, type, options) VALUES ('${key}', '${mod.name.replace(/'/g, "''")}', '${mod.type}', '${JSON.stringify(mod.options).replace(/'/g, "''")}');`);
}
finalSql.push('');

// 8. Insert Menu Items
finalSql.push('-- Insert Menu Items');
menuData.items.forEach(item => {
    const cat = menuData.categories.find(c => c.id === item.categoryId);
    if (!cat) return;

    const catName = cat.name;
    const variants = JSON.stringify(item.variants || []);
    // Convert array of strings to postgres array literal: ARRAY['opt1', 'opt2']
    const modifiers = item.modifiers && item.modifiers.length > 0
        ? `ARRAY[${item.modifiers.map(m => `'${m}'`).join(', ')}]`
        : "'{}'";

    const sql = `INSERT INTO menu_items (category_id, name, description, price, unit, image, variants, modifiers) VALUES ((SELECT id FROM temp_cat WHERE name = '${catName.replace(/'/g, "''")}' LIMIT 1), '${item.name.replace(/'/g, "''")}', '${(item.description || '').replace(/'/g, "''")}', ${item.price}, ${item.unit ? `'${item.unit}'` : 'NULL'}, '${item.image}', '${variants.replace(/'/g, "''")}', ${modifiers});`;
    finalSql.push(sql);
});

// 9. Cleanup temp table
finalSql.push('');
finalSql.push('DROP TABLE temp_cat;');

// 10. Write output
fs.writeFileSync('seed_data.sql', finalSql.join('\n'));

// 11. Cleanup temp file
if (fs.existsSync(tempCjsPath)) fs.unlinkSync(tempCjsPath);

console.log('Successfully generated seed_data.sql');
