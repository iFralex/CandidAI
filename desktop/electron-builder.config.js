module.exports = {
  appId: 'tech.candidai.desktop',
  productName: 'CandidAI',
  directories: { output: 'release' },
  protocols: [{ name: 'CandidAI', schemes: ['candidai'] }],
  mac: { target: 'dmg', icon: 'assets/icon.icns' },
  win: { target: 'nsis', icon: 'assets/icon.ico' },
  files: ['dist-renderer/**', 'dist-electron/**', 'package.json'],
};
