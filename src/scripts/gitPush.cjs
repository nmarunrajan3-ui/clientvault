const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');

async function pushToGitHub(token = process.env.GITHUB_TOKEN) {
  const dir = path.resolve('.');
  const remoteUrl = 'https://github.com/nmarunrajan3-ui/clientvault.git';

  // 1. Ensure remote is set
  const remotes = await git.listRemotes({ fs, dir });
  const hasOrigin = remotes.some((r) => r.remote === 'origin');
  if (hasOrigin) {
    await git.deleteRemote({ fs, dir, remote: 'origin' });
  }
  await git.addRemote({ fs, dir, remote: 'origin', url: remoteUrl });
  console.log('Set remote origin to:', remoteUrl);

  // 2. Ensure current branch is 'main'
  const currentBranch = await git.currentBranch({ fs, dir, fullname: false });
  console.log('Current branch is:', currentBranch);

  if (currentBranch !== 'main') {
    await git.branch({ fs, dir, ref: 'main', checkout: true });
    console.log('Switched/created branch main');
  }

  // 3. Attempt push
  console.log('Attempting git push to GitHub...');
  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    force: true,
    onAuth: () => {
      if (token) {
        return { username: token, password: '' };
      }
      return { username: 'oauth2', password: '' };
    },
  });

  console.log('Push successfully finished:', pushResult);
}

if (require.main === module) {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;
  pushToGitHub(token).catch((err) => {
    console.error('Git push failed:', err.message);
    if (err.data) console.error('Details:', err.data);
    process.exit(1);
  });
}

module.exports = { pushToGitHub };
