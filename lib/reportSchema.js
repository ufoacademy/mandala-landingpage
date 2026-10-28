const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    greeting: { type: 'string' },
    coreInsights: {
      type: 'array',
      items: { type: 'string' },
    },
    areaInterpretations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          areaId: { type: 'integer' },
          summary: { type: 'string' },
        },
        required: ['areaId', 'summary'],
        additionalProperties: false,
      },
    },
    pairedSections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          leftTitle: { type: 'string' },
          leftNarrative: { type: 'string' },
          rightTitle: { type: 'string' },
          rightNarrative: { type: 'string' },
          middleTitle: { type: 'string' },
          middleNarrative: { type: 'string' },
          highlightTitle: { type: 'string' },
          highlightContent: { type: 'string' },
        },
        required: [
          'leftTitle', 'leftNarrative',
          'rightTitle', 'rightNarrative',
          'middleTitle', 'middleNarrative',
          'highlightTitle', 'highlightContent',
        ],
        additionalProperties: false,
      },
    },
    priorityExplanation: { type: 'string' },
    nutritionPlan: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              evidenceSource: { type: 'string' },
            },
            required: ['title', 'description', 'evidenceSource'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'recommendations'],
      additionalProperties: false,
    },
    hopeMessage: { type: 'string' },
    ageGroupInsight: {
      type: 'object',
      properties: {
        diseaseName: { type: 'string' },
        motivationalSentence: { type: 'string' },
      },
      required: ['diseaseName', 'motivationalSentence'],
      additionalProperties: false,
    },
    grayZoneInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          mechanism: { type: 'string' },
        },
        required: ['name', 'mechanism'],
        additionalProperties: false,
      },
    },
    roadmap12Week: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          week: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['week', 'action'],
        additionalProperties: false,
      },
    },
    messagingExamples: {
      type: 'array',
      items: { type: 'string' },
    },
    finalConclusion: {
      type: 'object',
      properties: {
        oneLineSummary: { type: 'string' },
        whyStrong: { type: 'string' },
        finalProposal: { type: 'string' },
      },
      required: ['oneLineSummary', 'whyStrong', 'finalProposal'],
      additionalProperties: false,
    },
  },
  required: [
    'greeting',
    'coreInsights',
    'areaInterpretations',
    'pairedSections',
    'priorityExplanation',
    'nutritionPlan',
    'hopeMessage',
    'ageGroupInsight',
    'grayZoneInsights',
    'roadmap12Week',
    'messagingExamples',
    'finalConclusion',
  ],
  additionalProperties: false,
};

module.exports = { REPORT_SCHEMA };
