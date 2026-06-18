import { CredentialConfigCreate } from '@eudiplo/sdk-core';

export interface PredefinedConfig {
  name: string;
  description: string;
  icon: string;
  config: CredentialConfigCreate;
}

export const configs: PredefinedConfig[] = [
  {
    name: 'PID (Personal Identity Document)',
    description: 'German Personal Identity Document configuration',
    icon: 'badge',
    config: {
      id: 'pid',
      description: 'Personal ID',
      config: {
        format: 'dc+sd-jwt',
        display: [
          {
            name: 'PID',
            description: 'PID Credential',
            locale: 'en-US',
            background_color: '#FFFFFF',
            text_color: '#000000',
          },
          {
            name: 'PID',
            description: 'PID Nachweis',
            locale: 'de-DE',
            background_color: '#FFFFFF',
            text_color: '#000000',
          },
        ],
      },
      fields: [
        {
          path: ['address', 'country'],
          type: 'string',
          defaultValue: 'DE',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Country',
            },
            {
              locale: 'de-DE',
              name: 'Land',
            },
          ],
        },
        {
          path: ['address', 'locality'],
          type: 'string',
          defaultValue: 'KÖLN',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'City',
            },
            {
              locale: 'de-DE',
              name: 'Ort',
            },
          ],
        },
        {
          path: ['address', 'postal_code'],
          type: 'string',
          defaultValue: '51147',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Postal Code',
            },
            {
              locale: 'de-DE',
              name: 'Postleitzahl',
            },
          ],
        },
        {
          path: ['address', 'street_address'],
          type: 'string',
          defaultValue: 'HEIDESTRAẞE 17',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Street Address',
            },
            {
              locale: 'de-DE',
              name: 'Strasse und Hausnummer',
            },
          ],
        },
        {
          path: ['address'],
          type: 'object',
          defaultValue: {
            street_address: 'HEIDESTRAẞE 17',
            locality: 'KÖLN',
            country: 'DE',
            postal_code: '51147',
          },
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Address',
            },
            {
              locale: 'de-DE',
              name: 'Adresse',
            },
          ],
        },
        {
          path: ['age_birth_year'],
          type: 'integer',
          defaultValue: 1964,
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Birth Year',
            },
            {
              locale: 'de-DE',
              name: 'Geburtsjahr',
            },
          ],
        },
        {
          path: ['age_equal_or_over', '12'],
          type: 'boolean',
          defaultValue: true,
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Age 12 or Over',
            },
            {
              locale: 'de-DE',
              name: 'Alter 12 oder aelter',
            },
          ],
        },
        {
          path: ['age_equal_or_over', '14'],
          type: 'boolean',
          defaultValue: true,
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Age 14 or Over',
            },
            {
              locale: 'de-DE',
              name: 'Alter 14 oder aelter',
            },
          ],
        },
        {
          path: ['age_equal_or_over', '16'],
          type: 'boolean',
          defaultValue: true,
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Age 16 or Over',
            },
            {
              locale: 'de-DE',
              name: 'Alter 16 oder aelter',
            },
          ],
        },
        {
          path: ['age_equal_or_over', '18'],
          type: 'boolean',
          defaultValue: true,
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Age 18 or Over',
            },
            {
              locale: 'de-DE',
              name: 'Alter 18 oder aelter',
            },
          ],
        },
        {
          path: ['age_equal_or_over', '21'],
          type: 'boolean',
          defaultValue: true,
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Age 21 or Over',
            },
            {
              locale: 'de-DE',
              name: 'Alter 21 oder aelter',
            },
          ],
        },
        {
          path: ['age_equal_or_over', '65'],
          type: 'boolean',
          defaultValue: false,
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Age 65 or Over',
            },
            {
              locale: 'de-DE',
              name: 'Alter 65 oder aelter',
            },
          ],
        },
        {
          path: ['age_equal_or_over'],
          type: 'object',
          defaultValue: {
            '12': true,
            '14': true,
            '16': true,
            '18': true,
            '21': true,
            '65': false,
          },
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Age Assertions',
            },
            {
              locale: 'de-DE',
              name: 'Altersangaben',
            },
          ],
        },
        {
          path: ['age_in_years'],
          type: 'integer',
          defaultValue: 61,
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Age in Years',
            },
            {
              locale: 'de-DE',
              name: 'Alter in Jahren',
            },
          ],
        },
        {
          path: ['birthdate'],
          type: 'string',
          defaultValue: '1964-08-12',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Birth Date',
            },
            {
              locale: 'de-DE',
              name: 'Geburtsdatum',
            },
          ],
          constraints: {
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
        },
        {
          path: ['family_name'],
          type: 'string',
          defaultValue: 'MUSTERMANN',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Family Name',
            },
            {
              locale: 'de-DE',
              name: 'Nachname',
            },
          ],
        },
        {
          path: ['given_name'],
          type: 'string',
          defaultValue: 'ERIKA',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Given Name',
            },
            {
              locale: 'de-DE',
              name: 'Vorname',
            },
          ],
        },
        {
          path: ['issuing_authority'],
          type: 'string',
          defaultValue: 'DE',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Issuing Authority',
            },
            {
              locale: 'de-DE',
              name: 'Ausstellende Behoerde',
            },
          ],
        },
        {
          path: ['issuing_country'],
          type: 'string',
          defaultValue: 'DE',
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Issuing Country',
            },
            {
              locale: 'de-DE',
              name: 'Ausstellungsland',
            },
          ],
        },
        {
          path: ['nationalities', 0],
          type: 'string',
          defaultValue: 'DE',
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Nationality',
            },
            {
              locale: 'de-DE',
              name: 'Staatsangehoerigkeit',
            },
          ],
        },
        {
          path: ['nationalities'],
          type: 'array',
          defaultValue: ['DE'],
          mandatory: true,
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Nationalities',
            },
            {
              locale: 'de-DE',
              name: 'Staatsangehoerigkeiten',
            },
          ],
          constraints: {
            items: {
              type: 'string',
              title: 'Nationality',
            },
          },
        },
        {
          path: ['place_of_birth', 'locality'],
          type: 'string',
          defaultValue: 'BERLIN',
          mandatory: true,
          disclosable: false,
          display: [
            {
              locale: 'en-US',
              name: 'Place of Birth (City)',
            },
            {
              locale: 'de-DE',
              name: 'Geburtsort (Stadt)',
            },
          ],
        },
        {
          path: ['place_of_birth'],
          type: 'object',
          defaultValue: {
            locality: 'BERLIN',
          },
          disclosable: true,
          display: [
            {
              locale: 'en-US',
              name: 'Place of Birth',
            },
            {
              locale: 'de-DE',
              name: 'Geburtsort',
            },
          ],
        },
      ],
      vct: 'urn:eudi:pid:de:1',
      keyBinding: true,
      statusManagement: true,
      sdJwtTrustFormat: 'x5c',
      lifeTime: 604800,
    },
  },
  {
    name: 'SCA Payment Card (PASO)',
    description:
      'Bank-issued credential aligned with the base Payment rulebook (urn:paso:sca:global:payment:1).',
    icon: 'payments',
    config: {
      id: 'sca-payment',
      description: 'SCA Payment Card',
      config: {
        scope: 'sca-payment',
        format: 'dc+sd-jwt',
        display: [
          {
            name: 'SCA Card',
            description: 'SCA Card for Payment Authorization',
            locale: 'en-US',
            background_color: '#123456',
            text_color: '#FFFFFF',
          },
          {
            name: 'SCA Karte',
            description: 'SCA-Karte zur Zahlungsautorisierung',
            locale: 'de-DE',
            background_color: '#123456',
            text_color: '#FFFFFF',
          },
        ],
      },
      vct: 'https://bank.example/sca/card',
      keyBinding: true,
      statusManagement: true,
      sdJwtTrustFormat: 'x5c',
      lifeTime: 604800,
      // Credential attributes required by the Payment rulebook §1.
      fields: [
        {
          path: ['authorizing_party'],
          type: 'string',
          defaultValue: 'bank.example',
          mandatory: true,
          disclosable: true,
          display: [
            { locale: 'en-US', name: 'Authorizing Party' },
            { locale: 'de-DE', name: 'Autorisierende Stelle' },
          ],
        },
        {
          path: ['authorizing_party_name'],
          type: 'string',
          defaultValue: 'Example Bank',
          mandatory: true,
          disclosable: true,
          display: [
            { locale: 'en-US', name: 'Authorizing Party Name' },
            { locale: 'de-DE', name: 'Name der autorisierenden Stelle' },
          ],
        },
        {
          path: ['payment_network'],
          type: 'string',
          defaultValue: 'sepa.example',
          mandatory: true,
          disclosable: true,
          display: [
            { locale: 'en-US', name: 'Payment Network' },
            { locale: 'de-DE', name: 'Zahlungsnetzwerk' },
          ],
        },
        {
          path: ['payment_network_name'],
          type: 'string',
          defaultValue: 'SEPA Instant',
          mandatory: true,
          disclosable: true,
          display: [
            { locale: 'en-US', name: 'Payment Network Name' },
            { locale: 'de-DE', name: 'Name des Zahlungsnetzwerks' },
          ],
        },
      ],
      paso: {
        signedMetadataLifetimeSeconds: 86400,
        transactionDataTypes: {
          // Claim order is normative per the rulebook §2.
          'urn:paso:sca:global:payment:1': {
            claims: [
              { path: ['transaction_id'] },
              {
                path: ['amount'],
                mandatory: true,
                value_type: 'iso_currency_amount',
                display: [
                  { locale: 'en', name: 'Amount' },
                  { locale: 'de', name: 'Betrag' },
                ],
              },
              {
                path: ['payee', 'name'],
                mandatory: true,
                display: [
                  { locale: 'en', name: 'Payee' },
                  { locale: 'de', name: 'Empfänger' },
                ],
              },
              { path: ['payee', 'id'], mandatory: true },
              {
                path: ['payee', 'logo'],
                value_type: 'image',
                display: [
                  { locale: 'en', name: 'Payee logo' },
                  { locale: 'de', name: 'Logo des Empfängers' },
                ],
              },
              { path: ['payee', 'logo#integrity'] },
            ],
            ui_labels: {
              transaction_title: [
                { locale: 'en', value: 'Confirm Payment' },
                { locale: 'de', value: 'Zahlung bestätigen' },
              ],
              affirmative_action_label: [
                { locale: 'en', value: 'Pay' },
                { locale: 'de', value: 'Bezahlen' },
              ],
            },
          },
        },
      },
    } as CredentialConfigCreate,
  },
];
