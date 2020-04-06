module.exports = {
  base: "/",
  title: "Zondax Zemu",
  description: "Ledger Nano S/X Testing Framework",
  plugins: [
    [
      '@goy/svg-icons',
      "vuepress-plugin-mathjax",
    ],
  ],
  themeConfig: {
    repoLabel: "Contribute!",
    repo: "https://github.com/Zondax/Zemu",
    editLinks: true,
    editLinkText: "Help us improve this page",
    search: true,
    lastUpdated: "Last Updated",
    nav: [
      { text: "Home", link: "/" },
      { text: "About Zondax", link: "https://zondax.ch" },
    ],
    sidebar: "auto",
  },
  markdown: {
    "toc": { includeLevel: [2, 3] },
  },
};
