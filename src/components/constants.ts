export const triggerNode = [
    {
        name: 'Manual Trigger',
        icon: '',
        url: '',
        description:
          'Start the workflow manually from the UI or another explicit user action.',
      },
      {
        name: 'Schedule Trigger',
        icon: '',
        url: '',
        description:
          'Run the workflow automatically on a schedule, such as every hour or every day.',
      },
]


export const supportedNodeList = [
  {
    name: 'Run Code',
    icon: '',
    url: '',
    description:
      'Run custom code logic directly within the workflow when this node is executed.',
  },
  {
    name: 'API Call',
    icon: '',
    url: '',
    description:
      'Call an external HTTP API endpoint and use its response in the workflow.',
  },
  {
    name: 'Computation',
    icon: '',
    url: '',
    actions: [
        {
            name: 'Add',
            description:
              'Add two numbers together.',
        }, 
        {
            name: 'Subtract',
            description:
              'Subtract one number from another.',
        },
        {
            name: 'Multiply',
            description:
              'Multiply two numbers together.'
        },
        {
            name: 'Divide',
            description:
              'Divide one number by another.'
        },
        {
            name: 'Modulo',
            description:
              'Get the remainder of one number divided by another.'
        }
    ],
    description:
      'Perform mathematical calculations, string manipulations, or other data transformations.',
  }
]