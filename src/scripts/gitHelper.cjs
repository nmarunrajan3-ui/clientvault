const git = require('isomorphic-git');
const fs = require('fs');
const path = require('path');

async function stageAndCommit(message = 'Initial ClientVault Commit: Offline-first PWA + Supabase Cloud') {
  const dir = path.resolve('.');

  console.log('Staging files...');
  // Read all files ignoring node_modules, dist, .git, .env
  function getAllFiles(currentDir, fileList = []) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      if (['node_modules', 'dist', '.git', '.env', '.env.local'].includes(file)) continue;
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else {
        const relPath = path.relative(dir, fullPath).replace(/\\/g, '/');
        fileList.push(relPath);
      }
    }
    return fileList;
  }

  const filesToStage = getAllFiles(dir);
  for (const filepath of filesToStage) {
    await git.add({ fs, dir, filepath });
  }

  console.log(`Staged ${filesToStage.length} files. Creating commit...`);
  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'ClientVault Developer',
      email: 'dev@clientvault.local',
    },
    message,
  });

  console.log(`Commit created successfully! SHA: ${sha}`);
  return sha;
}

if (require.main === module) {
  stageAndCommit().catch((err) => {
    console.error('Commit failed:', err);
    process.exit(1);
  });
}

module.exports = { stageAndCommit };
