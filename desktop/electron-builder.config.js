module.exports = {
  appId: 'tech.candidai.app',
  productName: 'CandidAI',
  copyright: `Copyright © ${new Date().getFullYear()} CandidAI. All rights reserved.`,
  directories: { output: 'release' },
  protocols: [{ name: 'CandidAI', schemes: ['candidai'] }],

  mac: {
    target: 'dmg',
    icon: 'assets/icon.icns',
    category: 'public.app-category.productivity',
    darkModeSupport: true,
    minimumSystemVersion: '12.0',
    extraResources: [
      {
        from: '../browsers/mac-${arch}',
        to: 'browsers',
        filter: ['**/*'],
      },
    ],
    dmg: {
      title: 'CandidAI',
      background: null,
      window: { width: 540, height: 380 },
      contents: [
        { x: 150, y: 185, type: 'file' },
        { x: 390, y: 185, type: 'link', path: '/Applications' },
      ],
    },
  },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
    extraResources: [{ from: '../browsers/win', to: 'browsers', filter: ['**/*'] }],
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      installerIcon: 'assets/icon.ico',
      uninstallerIcon: 'assets/icon.ico',
      installerHeaderIcon: 'assets/icon.ico',
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'CandidAI',
    },
  },

  linux: {
    target: 'AppImage',
    icon: 'assets/icon.icns',
    category: 'Office',
    extraResources: [{ from: '../browsers/linux', to: 'browsers', filter: ['**/*'] }],
  },

  files: ['dist-renderer/**', 'dist-electron/**', 'package.json'],
};
