module.exports = {
  appId: 'tech.candidai.desktop',
  productName: 'CandidAI',
  directories: { output: 'release' },
  protocols: [{ name: 'CandidAI', schemes: ['candidai'] }],
  mac: {
    target: 'dmg',
    icon: 'assets/icon.icns',
    extraResources: [
      {
        from: '../browsers/mac-${arch}',
        to: 'browsers',
        filter: ['**/*'],
      },
    ],
  },
  win: {
    target: 'nsis',
    icon: 'assets/icon.ico',
    extraResources: [{ from: '../browsers/win', to: 'browsers', filter: ['**/*'] }],
  },
  linux: {
    target: 'AppImage',
    extraResources: [{ from: '../browsers/linux', to: 'browsers', filter: ['**/*'] }],
  },
  files: ['dist-renderer/**', 'dist-electron/**', 'package.json'],
};
