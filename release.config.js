const noteKeywords = ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'];

const commitAnalyzer = [
  '@semantic-release/commit-analyzer',
  {
    preset: 'angular',
    releaseRules: [
      { type: 'refactor', release: 'patch' },
      { type: 'revert', release: 'patch' },
    ],
    parserOpts: {
      noteKeywords,
    },
  },
];

const releaseNotesGenerator = [
  '@semantic-release/release-notes-generator',
  {
    preset: 'angular',
    parserOpts: {
      noteKeywords,
    },
    writerOpts: {
      commitsSort: ['subject', 'scope'],
    },
  },
];

const pluginsByPhase = {
  prep: [
    commitAnalyzer,
    releaseNotesGenerator,
    ['@semantic-release/changelog'],
    ['@semantic-release/npm'],
  ],
  all: [
    commitAnalyzer,
    releaseNotesGenerator,
    ['@semantic-release/changelog'],
    ['@semantic-release/npm'],
    ['@semantic-release/git'],
    ['@semantic-release/github'],
  ],
};

const phase = process.env.SEMANTIC_RELEASE_PHASE || 'all';
const plugins = pluginsByPhase[phase] || pluginsByPhase.all;

module.exports = {
  plugins,
};
