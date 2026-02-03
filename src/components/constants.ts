export const triggerNode = [
    {
        name: 'Manual Trigger',
        type: 'trigger',
        icon: '',
        url: '',
        description:
          'Start the workflow manually from the UI or another explicit user action.',
        configuration: [],
      },
      {
        name: 'Schedule Trigger',
        type: 'trigger',
        icon: '',
        url: '',
        description:
          'Run the workflow automatically on a schedule, such as every hour or every day.',
        configuration: [
          {
            type: 'select',
            label: 'Trigger on',
            description: 'The schedule to run the workflow on.',
            required: true,
            default: {
              label: 'Every minute',
              value: '* * * * *',
            },
            options: [
              {
                label: 'Every second',
                value: '* * * * * *',
              },
              {
                label: 'Every minute',
                value: '* * * * *',
              },
              {
                label: 'Every hour',
                value: '0 * * * *',
              },
              {
                label: 'Every day',
                value: '0 0 * * *',
              },
              {
                label: 'Every week',
                value: '0 0 * * 0',
              },
              {
                label: 'Every month',
                value: '0 0 1 * *',
              }
            ],
          },
          {
            type: 'number',
            label: ' between trigger',
            description: 'The time between triggers.',
            required: true,
            default: '1'
          },
          {
            type: 'time',
            label: 'Time',
            description: 'The time to trigger the workflow at.',
            required: true,
            default: '00:00'
          }
        ],
      },
]


export const supportedNodeList = [
  {
    name: 'Run Code',
    type: 'nodes',
    icon: '',
    url: '',
    description:
      'Run custom code logic directly within the workflow when this node is executed.',
    configuration: [
      {
        type: 'textarea',
        label: 'JavaScript Code',
        description: 'The JavaScript code to run.',
        required: true,
        default: 'console.log("Hello, world!")',
        language: 'javascript',
      }
    ],
  },  
  {
    name: 'API Call',
    type: 'nodes',
    icon: '',
    url: '',
    description:
      'Call an external HTTP API endpoint and use its response in the workflow.',
    configuration: [
      {
        type: 'text',
        label: 'URL',
        description: 'The URL to call.',
        required: true,
        default: 'https://api.example.com',
      },
      {
        type: 'text',
        label: 'Headers',
        description: 'The headers of the request.',
        required: false,
        default: '',
      },
      {
        type: 'select',
        label: 'Method',
        description: 'The HTTP method to use.',
        required: true,
        default: 'GET',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
          { label: 'PATCH', value: 'PATCH' },
        ],
      },
      {
        type: 'textarea',
        label: 'Body',
        description: 'The body of the request.',
        required: false,
        default: '',
        language: 'json',
      }
    ],
  },
  {
    name: 'Computation',
    type: 'nodes',
    icon: '',
    url: '',
    description:
      'Perform mathematical calculations, string manipulations, or other data transformations.',
    configuration: [
      {
        type: 'text',
        label: 'Expression Code',
        description: 'The expression to evaluate.',
        required: true,
        default: '1 + 1',
      }
    ],
  }
]