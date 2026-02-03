export const nodeActionType = {
  COMPUTATION: 'computation',
  API_CALL: 'api_call',
  RUN_CODE: 'run_code',
  SCHEDULE_TRIGGER: 'schedule_trigger',
  MANUAL_TRIGGER: 'manual_trigger',
}

// SVG icon paths for each node type
export const nodeIcons: Record<string, string> = {
  [nodeActionType.MANUAL_TRIGGER]: 'M8 5v14l11-7z', // Play icon
  [nodeActionType.SCHEDULE_TRIGGER]: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z', // Clock icon
  [nodeActionType.RUN_CODE]: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z', // Code icon
  [nodeActionType.API_CALL]: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', // Globe icon
  [nodeActionType.COMPUTATION]: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z', // Calculator/number icon
}

export const triggerNode = [
    {
        name: 'Manual Trigger',
        actionType: nodeActionType.MANUAL_TRIGGER,
        icon: nodeIcons[nodeActionType.MANUAL_TRIGGER],
        description:
          'Start the workflow manually from the UI or another explicit user action.',
        configuration: [],
      },
      {
        name: 'Schedule Trigger',
        actionType: nodeActionType.SCHEDULE_TRIGGER,
        icon: nodeIcons[nodeActionType.SCHEDULE_TRIGGER],
        description:
          'Run the workflow automatically on a schedule, such as every hour or every day.',
        configuration: [
          {
            type: 'select',
            labelType: 'TRIGGER_ON',
            label: 'Trigger on',
            description: 'The schedule to run the workflow on.',
            required: true,
            default: {
              label: 'Every minute',
              value: 'min',
            },
            options: [
              {
                label: 'Every second',
                value: 'sec',
              },
              {
                label: 'Every minute',
                value: 'min',
              },
              {
                label: 'Every hour',
                value: 'hour',
              },
              {
                label: 'Every day',
                value: 'day',
              },
              {
                label: 'Every week',
                value: 'week',
              },
              {
                label: 'Every month',
                value: 'month',
              }
            ],
          },
          {
            type: 'number',
            labelType: 'INTERVAL_BETWEEN_TRIGGER',
            label: ' between trigger',
            description: 'The time between triggers.',
            required: true,
            default: '1'
          },
          {
            type: 'time',
            labelType: 'TIME_TO_TRIGGER',
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
    actionType: nodeActionType.RUN_CODE,
    icon: nodeIcons[nodeActionType.RUN_CODE],
    description:
      'Run custom code logic directly within the workflow when this node is executed.',
    configuration: [
      {
        type: 'textarea',
        labelType: 'JAVASCRIPT_CODE',
        label: 'JavaScript Code',
        description: 'The JavaScript code to run.',
        required: true,
        default: 'console.log("Hello, world!")',
        language: 'javascript',
      }
    ]
  },  
  {
    name: 'API Call',
    actionType: nodeActionType.API_CALL,
    icon: nodeIcons[nodeActionType.API_CALL],
    description:
      'Call an external HTTP API endpoint and use its response in the workflow.',
    configuration: [
      {
        type: 'text',
        labelType: 'URL',
        label: 'URL',
        description: 'The URL to call.',
        required: true,
        default: 'https://api.example.com',
      },
      {
        type: 'text',
        labelType: 'HEADERS',
        label: 'Headers',
        description: 'The headers of the request.',
        required: false,
        default: '',
      },
      {
        type: 'select',
        labelType: 'METHOD',
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
        labelType: 'BODY',
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
    actionType: nodeActionType.COMPUTATION,
    icon: nodeIcons[nodeActionType.COMPUTATION],
    description:
      'Perform mathematical calculations, string manipulations, or other data transformations.',
    configuration: [
      {
        type: 'text',
        labelType: 'EXPRESSION_CODE',
        label: 'Expression Code',
        description: 'The expression to evaluate.',
        required: true,
        default: '1 + 1',
      }
    ],
  }
]