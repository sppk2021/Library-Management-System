import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace the seeding part to be inside a non-blocking IIFE or just try-catch
content = content.replace(
  `// Simple Seeding`,
  `// Simple Seeding
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL is not set. Skipping DB seeding and operations.");
    } else {`
);

content = content.replace(
  `  for (let i = 0; i < 150; i++) {
    const template = bookTitles[i % bookTitles.length];
    const suffix = i > 19 ? \` (Vol. \${Math.floor(i / 20) + 1})\` : '';
    const catId = ((i + (i % 30)) % 30) + 1; // Distribute across 30 categories
    
    await poolConnection.query(\`
      INSERT INTO books (title, author, isbn, category_id, quantity, available_quantity, shelf_location, cover_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`, [
      template.title + suffix, 
      template.author, 
      \`ISBN-\${1000 + i}-\${Math.floor(Math.random() * 9000) + 1000}\`,
      catId,
      1, // Each book is 1 per user request
      1,
      \`SEC-\${Math.floor(i/10)}-\${String.fromCharCode(65 + (i%5))}\`,
      bookCovers[i % bookCovers.length],
      Date.now()
    ]);
  }
}`,
  `  for (let i = 0; i < 150; i++) {
    const template = bookTitles[i % bookTitles.length];
    const suffix = i > 19 ? \` (Vol. \${Math.floor(i / 20) + 1})\` : '';
    const catId = ((i + (i % 30)) % 30) + 1; // Distribute across 30 categories
    
    await poolConnection.query(\`
      INSERT INTO books (title, author, isbn, category_id, quantity, available_quantity, shelf_location, cover_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`, [
      template.title + suffix, 
      template.author, 
      \`ISBN-\${1000 + i}-\${Math.floor(Math.random() * 9000) + 1000}\`,
      catId,
      1, // Each book is 1 per user request
      1,
      \`SEC-\${Math.floor(i/10)}-\${String.fromCharCode(65 + (i%5))}\`,
      bookCovers[i % bookCovers.length],
      Date.now()
    ]);
  }
}
    }
  } catch(e) {
    console.error("Failed to seed database:", e);
  }`
);

// We should also ensure API requests don't crash the server if DB is invalid? The unhandled promise rejection in an Express async route won't crash Express 5, but we are using Express 4. Let's just solve the startup issue first.

fs.writeFileSync('server.ts', content);
