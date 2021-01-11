module.exports = {
  title: 'Entertaining Games',
  tagline: 'Minimum Entertainment',
  url: 'https://entertaining.games/',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.png',
  organizationName: 'vicr123', // Usually your GitHub org/user name.
  projectName: 'entertaining', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'Entertaining Games',
      logo: {
        alt: 'Entertaining Games Logo',
        src: 'img/entertaining-logo.svg',
      },
      items: [
        {
          to: 'docs/apidocs/auth',
          activeBasePath: 'docs',
          label: 'Developers',
          position: 'right',
        },
        {
          href: 'https://github.com/vicr123/entertaining-server',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Games',
          items: [
            {
              label: 'Entertaining Mines',
              to: 'https://github.com/vicr123/entertaining-mines',
            },
            {
              label: 'Entertaining Chess',
              to: 'https://github.com/vicr123/entertaining-chess',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Victor Tran',
              to: 'https://vicr123.com/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Victor Tran. Built with Docusaurus.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js')
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/edit/master/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
