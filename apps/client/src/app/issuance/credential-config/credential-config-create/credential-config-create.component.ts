import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  CredentialConfigCreate,
  ClaimFieldDefinitionDto,
  FieldDisplayDto,
  keyChainControllerGetAll,
  KeyChainResponseDto,
  PresentationConfig,
  IaeActionOpenid4VpPresentation,
  IaeActionRedirectToWeb,
  attributeProviderControllerGetAll,
  webhookEndpointControllerGetAll,
  AttributeProviderEntity,
  WebhookEndpointEntity,
  PasoConfig,
  PasoTransactionDataTypeConfig,
  PasoClaimMetadata,
  PasoFieldDisplay,
  PasoUiLabels,
  PasoUiLabelEntry,
} from '@eudiplo/sdk-core';
import { PresentationManagementService } from '../../../presentation/presentation-config/presentation-management.service';
import { CredentialConfigService } from '../credential-config.service';
import { JsonViewDialogComponent } from './json-view-dialog/json-view-dialog.component';
import { configs } from './pre-config';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import {
  credentialConfigSchema,
  embeddedDisclosurePolicySchema,
  vctSchema,
} from '../../../utils/schemas';
import { EditorComponent, extractSchema } from '../../../utils/editor/editor.component';
import { ImageFieldComponent } from '../../../utils/image-field/image-field.component';
import { getApiErrorMessage } from '../../../utils/error-message';

@Component({
  selector: 'app-credential-config-create',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatDividerModule,
    MatMenuModule,
    MatTabsModule,
    MatTooltipModule,
    FlexLayoutModule,
    MatSlideToggleModule,
    MatExpansionModule,
    ReactiveFormsModule,
    RouterModule,
    MonacoEditorModule,
    EditorComponent,
    ImageFieldComponent,
    DragDropModule,
  ],
  templateUrl: './credential-config-create.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './credential-config-create.component.scss',
})
export class CredentialConfigCreateComponent implements OnInit {
  public form: FormGroup;
  public create = true;
  public loading = false;
  public submitAttempted = false;
  keyChains: KeyChainResponseDto[] = [];
  presentationConfigs: PresentationConfig[] = [];
  attributeProviders: AttributeProviderEntity[] = [];
  webhookEndpoints: WebhookEndpointEntity[] = [];

  predefinedConfigs = configs;

  // Lifetime presets in seconds
  lifetimePresets = [
    { label: '1 hour', value: 3600 },
    { label: '8 hours', value: 28800 },
    { label: '1 day', value: 86400 },
    { label: '7 days', value: 604800 },
    { label: '30 days', value: 2592000 },
    { label: '1 year', value: 31536000 },
    { label: 'Custom', value: null },
  ];

  // Common mDOC document types
  docTypePresets = [
    {
      label: 'Mobile Driving License (mDL)',
      value: 'org.iso.18013.5.1.mDL',
      namespace: 'org.iso.18013.5.1',
    },
    { label: 'EU PID', value: 'eu.europa.ec.eudi.pid.1', namespace: 'eu.europa.ec.eudi.pid.1' },
    { label: 'EU mDL', value: 'org.iso.18013.5.1.mDL', namespace: 'org.iso.18013.5.1' },
    { label: 'Custom', value: '', namespace: '' },
  ];

  selectedLifetimePreset: number | null = 3600;
  customLifetime = false;

  // Key attestation presets (HAIP-compliant values)
  keyAttestationPresets = [
    { label: 'ISO 18045 High', value: 'iso_18045_high' },
    { label: 'ISO 18045 Moderate', value: 'iso_18045_moderate' },
  ];

  vctSchema = vctSchema;
  embeddedDisclosurePolicySchema = embeddedDisclosurePolicySchema;

  readonly localeOptions = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'German' },
    { value: 'en-US', label: 'English (United States)' },
    { value: 'en-GB', label: 'English (United Kingdom)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'it-IT', label: 'Italian (Italy)' },
    { value: 'es-ES', label: 'Spanish (Spain)' },
  ];

  readonly fieldTypes: ClaimFieldDefinitionDto['type'][] = [
    'string',
    'number',
    'integer',
    'boolean',
    'object',
    'array',
  ];

  // VCT mode: 'string' for simple URI, 'object' for metadata object
  vctMode: 'string' | 'object' = 'string';

  get isMdocFormat(): boolean {
    return this.form.get('format')?.value === 'mso_mdoc';
  }

  constructor(
    private readonly credentialConfigService: CredentialConfigService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly presentationManagementService: PresentationManagementService
  ) {
    this.form = new FormGroup({
      id: new FormControl('', [Validators.required]),
      description: new FormControl('', Validators.required),
      format: new FormControl('dc+sd-jwt', [Validators.required]),
      keyChainId: new FormControl(''),
      scope: new FormControl(''),
      lifeTime: new FormControl(3600, [Validators.min(1)]),
      keyBinding: new FormControl(true, [Validators.required]),
      statusManagement: new FormControl(true, [Validators.required]),
      // SD-JWT specific fields
      vct: new FormControl(''),
      vctString: new FormControl(''),
      sdJwtTrustFormat: new FormControl('x5c'),
      // mDOC specific fields
      docType: new FormControl(''),
      namespace: new FormControl(''),
      fields: new FormArray([]),
      displayConfigs: new FormArray([this.createDisplayConfigGroup()]),
      embeddedDisclosurePolicy: new FormControl(''),
      attributeProviderId: new FormControl(''),
      webhookEndpointId: new FormControl(''),
      iaeActions: new FormArray([]),
      // Key attestation requirements (per-credential, HAIP compliance)
      keyAttestationEnabled: new FormControl(false),
      keyStorageTypes: new FormControl<string[]>([]),
      userAuthenticationTypes: new FormControl<string[]>([]),
      // PASO (Payment Authorization Service Operations) configuration
      paso: new FormGroup(
        {
          enabled: new FormControl(false),
          signedMetadataLifetimeSeconds: new FormControl<number | null>(null, [Validators.min(1)]),
          transactionDataTypes: new FormArray<FormGroup>([]),
        },
        {
          // Reject save when the user enabled PASO but didn't actually configure
          // any transaction data types. Without this guard, `buildPasoPayload`
          // silently returns null and the next reload shows the toggle as OFF.
          validators: [
            (group) => {
              const enabled = group.get('enabled')?.value;
              const tdts = group.get('transactionDataTypes') as FormArray | null;
              if (enabled && (!tdts || tdts.length === 0)) {
                return { pasoEnabledWithoutTransactionDataTypes: true };
              }
              return null;
            },
          ],
        }
      ),
    } as { [k in keyof Omit<CredentialConfigCreate, 'config'>]: any });

    // Set initial validator for vctString based on default mode
    if (this.vctMode === 'string') {
      this.form.get('vctString')?.setValidators([Validators.required]);
      this.form.get('vctString')?.updateValueAndValidity();
    }

    // When the user flips the PASO master toggle ON, seed an empty TDT row so
    // they have something to fill in. This subscription is suppressed during
    // patchPasoFromConfig (via emitEvent:false) to avoid double-seeding when
    // loading an existing credential.
    this.pasoGroup.get('enabled')?.valueChanges.subscribe((enabled) => {
      if (enabled && this.pasoTransactionDataTypes.length === 0) {
        this.addPasoTransactionDataType();
      }
      this.pasoGroup.updateValueAndValidity({ emitEvent: false });
    });

    // Listen for format changes to update validators
    this.form.get('format')?.valueChanges.subscribe((format) => {
      const vctStringControl = this.form.get('vctString');
      if (format === 'mso_mdoc') {
        // mDOC doesn't need vctString - clear validators
        vctStringControl?.clearValidators();
      } else {
        // SD-JWT needs vctString when in string mode
        if (this.vctMode === 'string') {
          vctStringControl?.setValidators([Validators.required]);
        }
      }
      vctStringControl?.updateValueAndValidity();
    });

    if (this.route.snapshot.params['id']) {
      this.create = false;
    }
  }
  ngOnInit() {
    // Load only attestation key chains for signing certificate selection
    keyChainControllerGetAll({ query: { usageType: 'attestation' } }).then(
      (res) => (this.keyChains = res.data || []),
      (error) => {
        console.error('Failed to load key chains:', error);
        this.snackBar.open('Failed to load key chains', 'Close', {
          duration: 3000,
        });
      }
    );

    // Load presentation configurations for IAE
    this.presentationManagementService.loadConfigurations().then(
      (configs) => (this.presentationConfigs = configs || []),
      (error) => {
        console.error('Failed to load presentation configs:', error);
      }
    );

    // Load attribute providers for selection
    attributeProviderControllerGetAll({}).then(
      (res) => (this.attributeProviders = (res.data || []) as AttributeProviderEntity[]),
      (error) => {
        console.error('Failed to load attribute providers:', error);
      }
    );

    // Load webhook endpoints for selection
    webhookEndpointControllerGetAll({}).then(
      (res) => (this.webhookEndpoints = (res.data || []) as WebhookEndpointEntity[]),
      (error) => {
        console.error('Failed to load webhook endpoints:', error);
      }
    );

    const id = this.route.snapshot.params['id'];
    if (!id) {
      return;
    }
    this.credentialConfigService.getConfig(id).then(
      (config) => {
        if (!config) {
          this.snackBar.open('Config not found', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['../'], { relativeTo: this.route });
          return;
        }

        this.patchFormFromConfig(config);
        this.form.get('id')?.disable();
      },
      (error) => {
        console.error('Error loading key:', error);
        this.snackBar.open('Failed to load key', 'Close', {
          duration: 3000,
        });
      }
    );
  }

  onSubmit() {
    this.submitAttempted = true;

    if (this.form.invalid) {
      this.markFormGroupTouched();
      const invalidFields = this.getInvalidFields();
      this.snackBar.open(`Please fix invalid fields: ${invalidFields.join(', ')}`, 'Close', {
        duration: 5000,
      });
      console.log('Invalid fields:', invalidFields);
      return;
    }

    // Additional validation for SD-JWT: VCT URI is required
    const isMdoc = this.form.get('format')?.value === 'mso_mdoc';
    if (!isMdoc && this.vctMode === 'string') {
      const vctString = this.form.get('vctString')?.value?.trim();
      if (!vctString) {
        this.form.get('vctString')?.setErrors({ required: true });
        this.form.get('vctString')?.markAsTouched();
        this.snackBar.open('VCT URI is required for SD-JWT credentials', 'Close', {
          duration: 3000,
        });
        return;
      }
    }

    this.loading = true;

    try {
      const formValue = this.buildConfigurationPayload();
      const configId = this.route.snapshot.params['id'];

      const savePromise = this.create
        ? this.credentialConfigService.saveConfiguration(formValue)
        : this.credentialConfigService.updateConfiguration(configId, formValue);

      savePromise
        .then(
          () => {
            this.snackBar.open(
              `Configuration ${this.create ? 'created' : 'updated'} successfully`,
              'Close',
              { duration: 3000 }
            );
            this.router.navigate(['../'], { relativeTo: this.route });
          },
          (error) => {
            console.error('Error saving configuration:', error);
            this.snackBar.open(getApiErrorMessage(error, 'Failed to save configuration'), 'Close', {
              duration: 3000,
            });
          }
        )
        .finally(() => {
          this.loading = false;
        });
    } catch {
      this.snackBar.open('Invalid JSON format in one of the fields', 'Close', {
        duration: 3000,
      });
      this.loading = false;
    }
  }

  private countInvalidControls(control: AbstractControl | null): number {
    if (!control) {
      return 0;
    }

    if (control instanceof FormControl) {
      return control.invalid ? 1 : 0;
    }

    if (control instanceof FormGroup || control instanceof FormArray) {
      return Object.values(control.controls).reduce(
        (sum, child) => sum + this.countInvalidControls(child),
        0
      );
    }

    return 0;
  }

  private metadataInvalidCount(): number {
    const base = ['id', 'description', 'format', 'lifeTime'].reduce(
      (sum, name) => sum + this.countInvalidControls(this.form.get(name)),
      0
    );

    const isMdoc = this.form.get('format')?.value === 'mso_mdoc';
    if (!isMdoc && this.vctMode === 'string') {
      return base + this.countInvalidControls(this.form.get('vctString'));
    }

    return base;
  }

  private businessInvalidCount(): number {
    return this.countInvalidControls(this.form.get('iaeActions'));
  }

  private visualInvalidCount(): number {
    return this.countInvalidControls(this.form.get('displayConfigs'));
  }

  private fieldsInvalidCount(): number {
    return this.countInvalidControls(this.form.get('fields'));
  }

  private pasoInvalidCount(): number {
    const enabled = !!this.form.get('paso.enabled')?.value;
    if (!enabled) {
      return 0;
    }
    // Count nested control errors plus the group-level
    // `pasoEnabledWithoutTransactionDataTypes` error (which has no FormControl
    // to attach to and would otherwise be invisible in the tab badge).
    const nested = this.countInvalidControls(this.form.get('paso'));
    const groupLevel = this.pasoGroup.errors?.['pasoEnabledWithoutTransactionDataTypes'] ? 1 : 0;
    return nested + groupLevel;
  }

  getTabInvalidCount(tab: 'metadata' | 'business' | 'display' | 'fields' | 'paso'): number {
    switch (tab) {
      case 'metadata':
        return this.metadataInvalidCount();
      case 'business':
        return this.businessInvalidCount();
      case 'display':
        return this.visualInvalidCount();
      case 'fields':
        return this.fieldsInvalidCount();
      case 'paso':
        return this.pasoInvalidCount();
      default:
        return 0;
    }
  }

  showTabError(tab: 'metadata' | 'business' | 'display' | 'fields' | 'paso'): boolean {
    if (this.getTabInvalidCount(tab) === 0) {
      return false;
    }

    return (
      this.submitAttempted ||
      this.tabHasUserVisibleErrors(tab) ||
      (this.form.invalid && this.form.dirty)
    );
  }

  private hasTouchedOrDirtyInvalid(control: AbstractControl | null): boolean {
    if (!control) {
      return false;
    }

    if (control instanceof FormControl) {
      return control.invalid && (control.touched || control.dirty);
    }

    if (control instanceof FormGroup || control instanceof FormArray) {
      return Object.values(control.controls).some((child) => this.hasTouchedOrDirtyInvalid(child));
    }

    return false;
  }

  private tabHasUserVisibleErrors(
    tab: 'metadata' | 'business' | 'display' | 'fields' | 'paso'
  ): boolean {
    switch (tab) {
      case 'metadata': {
        const hasBaseErrors = ['id', 'description', 'format', 'lifeTime'].some((name) =>
          this.hasTouchedOrDirtyInvalid(this.form.get(name))
        );

        const isMdoc = this.form.get('format')?.value === 'mso_mdoc';
        const hasVctErrors =
          !isMdoc && this.vctMode === 'string'
            ? this.hasTouchedOrDirtyInvalid(this.form.get('vctString'))
            : false;

        return hasBaseErrors || hasVctErrors;
      }
      case 'business':
        return this.hasTouchedOrDirtyInvalid(this.form.get('iaeActions'));
      case 'display':
        return this.hasTouchedOrDirtyInvalid(this.form.get('displayConfigs'));
      case 'fields':
        return this.hasTouchedOrDirtyInvalid(this.form.get('fields'));
      case 'paso': {
        if (!this.form.get('paso.enabled')?.value) {
          return false;
        }
        return this.hasTouchedOrDirtyInvalid(this.form.get('paso'));
      }
      default:
        return false;
    }
  }

  getFormGroup(controlName: string): FormGroup {
    return this.form.get(controlName) as FormGroup;
  }

  getControl(value: any) {
    return value as FormControl;
  }

  /**
   * Patch form with configuration data (reusable for edit mode and JSON load)
   */
  private patchFormFromConfig(config: CredentialConfigCreate): void {
    const normalizedConfig = config;

    // Determine VCT mode based on the type of vct value
    if (normalizedConfig.vct) {
      if (typeof normalizedConfig.vct === 'string') {
        this.vctMode = 'string';
      } else {
        this.vctMode = 'object';
      }
    }

    // Update vctString validators based on mode
    const vctStringControl = this.form.get('vctString');
    if (this.vctMode === 'string') {
      vctStringControl?.setValidators([Validators.required]);
    } else {
      vctStringControl?.clearValidators();
    }
    vctStringControl?.updateValueAndValidity();

    this.form.patchValue({
      id: normalizedConfig.id || '',
      keyChainId: normalizedConfig.keyChainId || '',
      format: normalizedConfig.config?.format || 'dc+sd-jwt',
      scope: normalizedConfig.config?.scope || '',
      description: normalizedConfig.description || '',
      lifeTime: normalizedConfig.lifeTime || 3600,
      keyBinding: normalizedConfig.keyBinding ?? true,
      statusManagement: normalizedConfig.statusManagement ?? true,
      attributeProviderId: normalizedConfig.attributeProviderId || '',
      webhookEndpointId: normalizedConfig.webhookEndpointId || '',
      // SD-JWT specific
      vct:
        typeof normalizedConfig.vct === 'object' ? this.stringifyField(normalizedConfig.vct) : '',
      vctString: typeof normalizedConfig.vct === 'string' ? normalizedConfig.vct : '',
      sdJwtTrustFormat: (normalizedConfig as any).sdJwtTrustFormat || 'x5c',
      // mDOC specific
      docType: normalizedConfig.config?.docType || '',
      namespace: (normalizedConfig.config as any)?.namespace || '',
      displayConfigs: normalizedConfig.config?.display || [],
      embeddedDisclosurePolicy: this.stringifyField(normalizedConfig.embeddedDisclosurePolicy),
      // Key attestation requirements
      keyAttestationEnabled: !!(normalizedConfig.config as any)?.keyAttestationsRequired,
      keyStorageTypes: (normalizedConfig.config as any)?.keyAttestationsRequired?.key_storage || [],
      userAuthenticationTypes:
        (normalizedConfig.config as any)?.keyAttestationsRequired?.user_authentication || [],
    } as any);

    this.fields.clear();
    for (const field of normalizedConfig.fields || []) {
      this.fields.push(this.createFieldGroup(field));
    }

    // Handle IAE actions
    this.iaeActions.clear();
    if (normalizedConfig.iaeActions?.length) {
      normalizedConfig.iaeActions.forEach((action) =>
        this.iaeActions.push(this.createIaeActionGroup(action))
      );
    }

    // Handle PASO configuration
    this.patchPasoFromConfig((normalizedConfig as any).paso ?? null);

    // Update lifetime preset selection
    this.updateLifetimePresetFromValue(normalizedConfig.lifeTime || 3600);
  }

  /**
   * Update lifetime preset selection based on value
   */
  private updateLifetimePresetFromValue(value: number): void {
    const preset = this.lifetimePresets.find((p) => p.value === value);
    if (preset) {
      this.selectedLifetimePreset = preset.value;
      this.customLifetime = false;
    } else {
      this.selectedLifetimePreset = null;
      this.customLifetime = true;
    }
  }

  /**
   * Handle lifetime preset selection
   */
  onLifetimePresetChange(presetValue: number | null): void {
    this.selectedLifetimePreset = presetValue;
    if (presetValue === null) {
      this.customLifetime = true;
    } else {
      this.customLifetime = false;
      this.form.get('lifeTime')?.setValue(presetValue);
    }
  }

  /**
   * Handle VCT mode change
   */
  onVctModeChange(mode: 'string' | 'object'): void {
    this.vctMode = mode;
    const vctStringControl = this.form.get('vctString');
    if (mode === 'string') {
      // Clear the vct object field when switching to string mode
      this.form.get('vct')?.setValue('');
      // Add required validator for vctString
      vctStringControl?.setValidators([Validators.required]);
    } else {
      // Clear the vctString field when switching to object mode
      // The vct URL will be auto-generated by EUDIPLO, user only provides other metadata
      vctStringControl?.setValue('');
      // Remove required validator for vctString
      vctStringControl?.clearValidators();
    }
    vctStringControl?.updateValueAndValidity();
  }

  /**
   * Get the auto-generated VCT URI based on the credential config ID
   */
  getVctUri(): string {
    const configId = this.form.get('id')?.value || '<credential-id>';
    // The actual tenant ID will be determined server-side, show placeholder
    return `<PUBLIC_URL>/<tenantId>/credentials-metadata/vct/${configId}`;
  }

  /**
   * Handle docType preset selection
   */
  onDocTypePresetChange(preset: { value: string; namespace: string }): void {
    this.form.get('docType')?.setValue(preset.value);
    if (preset.namespace) {
      this.form.get('namespace')?.setValue(preset.namespace);
    }
  }

  /**
   * Format lifetime value for display
   */
  formatLifetime(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months`;
    return `${Math.floor(seconds / 31536000)} years`;
  }

  private markControlTreeTouched(control: AbstractControl | null): void {
    if (!control) {
      return;
    }

    control.markAsTouched();

    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.values(control.controls).forEach((child) => this.markControlTreeTouched(child));
    }
  }

  private markFormGroupTouched(): void {
    this.markControlTreeTouched(this.form);
  }

  /**
   * Get list of invalid field names for debugging
   */
  private getInvalidFields(): string[] {
    const invalidFields: string[] = [];
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      if (control?.invalid) {
        // Check if it's a FormArray (like displayConfigs)
        if (control instanceof FormArray) {
          control.controls.forEach((group, index) => {
            if (group instanceof FormGroup) {
              Object.keys(group.controls).forEach((childKey) => {
                if (group.get(childKey)?.invalid) {
                  invalidFields.push(`${key}[${index}].${childKey}`);
                }
              });
            }
          });
        } else {
          invalidFields.push(key);
        }
      }
    });
    return invalidFields;
  }

  // Display Configuration Management
  createDisplayConfigGroup(): FormGroup {
    return new FormGroup({
      name: new FormControl('', [Validators.required]),
      description: new FormControl('', [Validators.required]),
      locale: new FormControl('en-US', [Validators.required]),
      background_color: new FormControl('#FFFFFF'),
      text_color: new FormControl('#000000'),
      // Handle both nested (from API/JSON) and flattened (from form) formats
      background_image: new FormGroup({
        uri: new FormControl(''),
      }),
      logo: new FormGroup({
        uri: new FormControl(''),
      }),
    });
  }

  get displayConfigs(): FormArray {
    return this.form.get('displayConfigs') as FormArray;
  }

  addDisplayConfig(): void {
    this.displayConfigs.push(this.createDisplayConfigGroup());
  }

  removeDisplayConfig(index: number): void {
    if (this.displayConfigs.length > 1) {
      this.displayConfigs.removeAt(index);
    }
  }

  // Field Definition Management
  createFieldDisplayGroup(display?: FieldDisplayDto): FormGroup {
    const displayEntry = display as FieldDisplayDto;

    return new FormGroup({
      locale: new FormControl(displayEntry?.locale || 'en-US', [Validators.required]),
      name: new FormControl(displayEntry?.name || '', [Validators.required]),
      description: new FormControl(display?.description || ''),
    });
  }

  createFieldGroup(field?: ClaimFieldDefinitionDto): FormGroup {
    const display = new FormArray(
      (field?.display || []).map((entry) => this.createFieldDisplayGroup(entry))
    );

    return new FormGroup({
      path: new FormControl(field?.path?.join('.') || '', [Validators.required]),
      type: new FormControl(field?.type || 'string', [Validators.required]),
      defaultValue: new FormControl(this.stringifyField(field?.defaultValue)),
      mandatory: new FormControl(!!field?.mandatory),
      disclosable: new FormControl(field?.disclosable ?? true),
      namespace: new FormControl(field?.namespace || ''),
      display,
    });
  }

  get fields(): FormArray {
    return this.form.get('fields') as FormArray;
  }

  getFieldGroup(index: number): FormGroup {
    return this.fields.at(index) as FormGroup;
  }

  getFieldDisplayArray(fieldIndex: number): FormArray {
    return this.getFieldGroup(fieldIndex).get('display') as FormArray;
  }

  addField(): void {
    this.fields.push(this.createFieldGroup());
  }

  removeField(index: number): void {
    this.fields.removeAt(index);
  }

  addFieldDisplay(fieldIndex: number): void {
    this.getFieldDisplayArray(fieldIndex).push(this.createFieldDisplayGroup());
  }

  removeFieldDisplay(fieldIndex: number, displayIndex: number): void {
    this.getFieldDisplayArray(fieldIndex).removeAt(displayIndex);
  }

  // IAE Actions Management
  iaeActionTypes = [
    { value: 'openid4vp_presentation', label: 'OID4VP Presentation', icon: 'verified_user' },
    { value: 'redirect_to_web', label: 'Redirect to Web', icon: 'open_in_browser' },
  ];

  createIaeActionGroup(
    action?: IaeActionOpenid4VpPresentation | IaeActionRedirectToWeb
  ): FormGroup {
    if (action?.type === 'redirect_to_web') {
      return new FormGroup({
        type: new FormControl('redirect_to_web', [Validators.required]),
        label: new FormControl(action.label || ''),
        url: new FormControl(action.url || '', [Validators.required]),
        callbackUrl: new FormControl(action.callbackUrl || ''),
        description: new FormControl(action.description || ''),
      });
    }
    // Default to openid4vp_presentation
    return new FormGroup({
      type: new FormControl('openid4vp_presentation', [Validators.required]),
      label: new FormControl((action as IaeActionOpenid4VpPresentation)?.label || ''),
      presentationConfigId: new FormControl(
        (action as IaeActionOpenid4VpPresentation)?.presentationConfigId || '',
        [Validators.required]
      ),
    });
  }

  get iaeActions(): FormArray {
    return this.form.get('iaeActions') as FormArray;
  }

  addIaeAction(
    type: 'openid4vp_presentation' | 'redirect_to_web' = 'openid4vp_presentation'
  ): void {
    const action =
      type === 'redirect_to_web'
        ? { type: 'redirect_to_web' as const, url: '', label: '' }
        : { type: 'openid4vp_presentation' as const, presentationConfigId: '', label: '' };
    this.iaeActions.push(this.createIaeActionGroup(action));
  }

  removeIaeAction(index: number): void {
    this.iaeActions.removeAt(index);
  }

  moveIaeAction(index: number, direction: 'up' | 'down'): void {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.iaeActions.length) return;

    const action = this.iaeActions.at(index);
    this.iaeActions.removeAt(index);
    this.iaeActions.insert(newIndex, action);
  }

  onIaeActionTypeChange(index: number, newType: string): void {
    const currentAction = this.iaeActions.at(index) as FormGroup;
    const currentLabel = currentAction.get('label')?.value || '';

    this.iaeActions.removeAt(index);
    const newAction =
      newType === 'redirect_to_web'
        ? { type: 'redirect_to_web' as const, url: '', label: currentLabel }
        : {
            type: 'openid4vp_presentation' as const,
            presentationConfigId: '',
            label: currentLabel,
          };
    this.iaeActions.insert(index, this.createIaeActionGroup(newAction));
  }

  dropIaeAction(event: CdkDragDrop<FormGroup[]>): void {
    moveItemInArray(this.iaeActions.controls, event.previousIndex, event.currentIndex);
    this.iaeActions.updateValueAndValidity();
  }

  // ===== PASO (Payment Authorization Service Operations) =====

  readonly pasoUrnPattern = /^urn:paso:sca:[^:]+:[^:]+:[^:]+$/;

  readonly pasoUiLabelKinds: {
    key: 'affirmative_action_label' | 'denial_action_label' | 'transaction_title' | 'security_hint';
    label: string;
    icon: string;
    hint: string;
  }[] = [
    {
      key: 'transaction_title',
      label: 'Transaction title',
      icon: 'title',
      hint: 'Headline shown to the user.',
    },
    {
      key: 'affirmative_action_label',
      label: 'Affirmative action label',
      icon: 'check_circle',
      hint: 'Label for the confirm / approve button.',
    },
    {
      key: 'denial_action_label',
      label: 'Denial action label',
      icon: 'cancel',
      hint: 'Label for the deny / cancel button.',
    },
    {
      key: 'security_hint',
      label: 'Security hint',
      icon: 'shield',
      hint: 'Security guidance shown to the user.',
    },
  ];

  get pasoGroup(): FormGroup {
    return this.form.get('paso') as FormGroup;
  }

  get pasoTransactionDataTypes(): FormArray<FormGroup> {
    return this.pasoGroup.get('transactionDataTypes') as FormArray<FormGroup>;
  }

  getPasoTypeGroup(index: number): FormGroup {
    return this.pasoTransactionDataTypes.at(index) as FormGroup;
  }

  getPasoClaimsArray(typeIndex: number): FormArray<FormGroup> {
    return this.getPasoTypeGroup(typeIndex).get('claims') as FormArray<FormGroup>;
  }

  getPasoClaimGroup(typeIndex: number, claimIndex: number): FormGroup {
    return this.getPasoClaimsArray(typeIndex).at(claimIndex) as FormGroup;
  }

  getPasoClaimDisplayArray(typeIndex: number, claimIndex: number): FormArray<FormGroup> {
    return this.getPasoClaimGroup(typeIndex, claimIndex).get('display') as FormArray<FormGroup>;
  }

  getPasoUiLabelsGroup(typeIndex: number): FormGroup {
    return this.getPasoTypeGroup(typeIndex).get('ui_labels') as FormGroup;
  }

  getPasoUiLabelEntries(
    typeIndex: number,
    key: 'affirmative_action_label' | 'denial_action_label' | 'transaction_title' | 'security_hint'
  ): FormArray<FormGroup> {
    return this.getPasoUiLabelsGroup(typeIndex).get(key) as FormArray<FormGroup>;
  }

  private createPasoFieldDisplayGroup(entry?: PasoFieldDisplay): FormGroup {
    return new FormGroup({
      locale: new FormControl(entry?.locale ?? 'en-US', [Validators.required]),
      name: new FormControl(entry?.name ?? '', [Validators.required]),
      display_type: new FormControl(entry?.display_type ?? ''),
    });
  }

  private createPasoClaimGroup(claim?: PasoClaimMetadata): FormGroup {
    const displays = (claim?.display ?? []).map((d) => this.createPasoFieldDisplayGroup(d));
    return new FormGroup({
      path: new FormControl(this.joinPasoPath(claim?.path), [Validators.required]),
      mandatory: new FormControl(!!claim?.mandatory),
      value_type: new FormControl(claim?.value_type ?? ''),
      display: new FormArray<FormGroup>(displays),
    });
  }

  private createPasoUiLabelEntryGroup(entry?: PasoUiLabelEntry): FormGroup {
    return new FormGroup({
      locale: new FormControl(entry?.locale ?? 'en-US'),
      value: new FormControl(entry?.value ?? '', [Validators.required]),
      value_type: new FormControl(entry?.value_type ?? ''),
    });
  }

  private createPasoUiLabelsGroup(labels?: PasoUiLabels | null): FormGroup {
    const build = (entries?: PasoUiLabelEntry[]) =>
      new FormArray<FormGroup>((entries ?? []).map((e) => this.createPasoUiLabelEntryGroup(e)));
    return new FormGroup({
      affirmative_action_label: build(labels?.affirmative_action_label),
      denial_action_label: build(labels?.denial_action_label),
      transaction_title: build(labels?.transaction_title),
      security_hint: build(labels?.security_hint),
    });
  }

  private createPasoTransactionDataTypeGroup(
    key?: string,
    config?: PasoTransactionDataTypeConfig
  ): FormGroup {
    const claims = (config?.claims ?? []).map((c) => this.createPasoClaimGroup(c));
    return new FormGroup({
      key: new FormControl(key ?? '', [
        Validators.required,
        Validators.pattern(this.pasoUrnPattern),
      ]),
      claims: new FormArray<FormGroup>(claims),
      ui_labels: this.createPasoUiLabelsGroup(config?.ui_labels ?? null),
    });
  }

  addPasoTransactionDataType(): void {
    this.pasoTransactionDataTypes.push(
      this.createPasoTransactionDataTypeGroup(undefined, {
        claims: [
          {
            path: [],
          } as PasoClaimMetadata,
        ],
      })
    );
  }

  removePasoTransactionDataType(index: number): void {
    this.pasoTransactionDataTypes.removeAt(index);
  }

  addPasoClaim(typeIndex: number): void {
    this.getPasoClaimsArray(typeIndex).push(
      this.createPasoClaimGroup({ path: [] } as PasoClaimMetadata)
    );
  }

  removePasoClaim(typeIndex: number, claimIndex: number): void {
    this.getPasoClaimsArray(typeIndex).removeAt(claimIndex);
  }

  addPasoClaimDisplay(typeIndex: number, claimIndex: number): void {
    this.getPasoClaimDisplayArray(typeIndex, claimIndex).push(this.createPasoFieldDisplayGroup());
  }

  removePasoClaimDisplay(typeIndex: number, claimIndex: number, displayIndex: number): void {
    this.getPasoClaimDisplayArray(typeIndex, claimIndex).removeAt(displayIndex);
  }

  addPasoUiLabelEntry(
    typeIndex: number,
    key: 'affirmative_action_label' | 'denial_action_label' | 'transaction_title' | 'security_hint'
  ): void {
    this.getPasoUiLabelEntries(typeIndex, key).push(this.createPasoUiLabelEntryGroup());
  }

  removePasoUiLabelEntry(
    typeIndex: number,
    key: 'affirmative_action_label' | 'denial_action_label' | 'transaction_title' | 'security_hint',
    entryIndex: number
  ): void {
    this.getPasoUiLabelEntries(typeIndex, key).removeAt(entryIndex);
  }

  /**
   * Parse a dot-separated PASO path into the (string | number | null)[] format the
   * backend expects. Segments matching /^-?\d+$/ become numbers; the literal `null`
   * becomes null; everything else stays a string.
   */
  private parsePasoPath(value: string | null | undefined): (string | number | null)[] {
    if (!value) {
      return [];
    }
    return value
      .split('.')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        if (segment === 'null') return null;
        if (/^-?\d+$/.test(segment)) return Number(segment);
        return segment;
      });
  }

  /**
   * Inverse of parsePasoPath — render a stored PASO path as a dot-separated string
   * for editing in the UI. Null segments are rendered as the literal `null`.
   */
  private joinPasoPath(parts: (string | number | null)[] | undefined): string {
    if (!parts || parts.length === 0) {
      return '';
    }
    return parts.map((p) => (p === null ? 'null' : String(p))).join('.');
  }

  private patchPasoFromConfig(paso: PasoConfig | null): void {
    this.pasoTransactionDataTypes.clear();

    if (!paso) {
      // Suppress the auto-seed in our `enabled` valueChanges subscription so
      // clearing the form on load doesn't push an empty TDT row.
      this.pasoGroup.patchValue(
        { enabled: false, signedMetadataLifetimeSeconds: null },
        { emitEvent: false }
      );
      this.pasoGroup.updateValueAndValidity({ emitEvent: false });
      return;
    }

    // The toggle is ON whenever the credential has *any* paso block persisted,
    // even if `transactionDataTypes` is currently empty. This lets users fix
    // an empty-paso row that previously slipped past the validator instead of
    // having the whole PASO panel silently collapse.
    const entries = Object.entries(paso.transactionDataTypes ?? {});
    this.pasoGroup.patchValue(
      {
        enabled: true,
        signedMetadataLifetimeSeconds: paso.signedMetadataLifetimeSeconds ?? null,
      },
      { emitEvent: false }
    );

    for (const [key, config] of entries) {
      this.pasoTransactionDataTypes.push(this.createPasoTransactionDataTypeGroup(key, config));
    }

    // Re-evaluate the group-level validator so the "enabled but no TDTs"
    // error surfaces immediately when reopening a broken row.
    this.pasoGroup.updateValueAndValidity({ emitEvent: false });
  }

  private buildPasoPayload(rawPaso: any): PasoConfig | null {
    if (!rawPaso || !rawPaso.enabled) {
      return null;
    }

    const transactionDataTypes: Record<string, PasoTransactionDataTypeConfig> = {};
    const rawTypes: any[] = rawPaso.transactionDataTypes || [];

    for (const rawType of rawTypes) {
      const key = (rawType.key || '').trim();
      if (!key) continue;

      const claims: PasoClaimMetadata[] = (rawType.claims || [])
        .map((rawClaim: any) => {
          const path = this.parsePasoPath(rawClaim.path);
          if (path.length === 0) {
            return null;
          }

          const display = (rawClaim.display || [])
            .map((d: any) => {
              const locale = (d.locale || '').trim();
              const name = (d.name || '').trim();
              if (!locale || !name) {
                return null;
              }
              const entry: PasoFieldDisplay = { locale, name };
              const display_type = (d.display_type || '').trim();
              if (display_type) {
                entry.display_type = display_type;
              }
              return entry;
            })
            .filter((d: PasoFieldDisplay | null): d is PasoFieldDisplay => !!d);

          const claim: PasoClaimMetadata = { path };
          if (rawClaim.mandatory) {
            claim.mandatory = true;
          }
          if (display.length > 0) {
            claim.display = display;
            const value_type = (rawClaim.value_type || '').trim();
            if (value_type) {
              claim.value_type = value_type;
            }
          }
          return claim;
        })
        .filter((c: PasoClaimMetadata | null): c is PasoClaimMetadata => !!c);

      const ui_labels = this.buildPasoUiLabelsPayload(rawType.ui_labels);

      const typeConfig: PasoTransactionDataTypeConfig = { claims };
      if (ui_labels) {
        typeConfig.ui_labels = ui_labels;
      }

      transactionDataTypes[key] = typeConfig;
    }

    if (Object.keys(transactionDataTypes).length === 0) {
      return null;
    }

    const result: PasoConfig = { transactionDataTypes };
    if (
      rawPaso.signedMetadataLifetimeSeconds !== null &&
      rawPaso.signedMetadataLifetimeSeconds !== undefined &&
      rawPaso.signedMetadataLifetimeSeconds !== ''
    ) {
      result.signedMetadataLifetimeSeconds = Number(rawPaso.signedMetadataLifetimeSeconds);
    }
    return result;
  }

  private buildPasoUiLabelsPayload(rawLabels: any): PasoUiLabels | undefined {
    if (!rawLabels) {
      return undefined;
    }
    const collect = (entries: any[] | undefined): PasoUiLabelEntry[] => {
      return (entries || [])
        .map((e) => {
          const value = (e?.value || '').trim();
          if (!value) return null;
          const entry: PasoUiLabelEntry = { value };
          const locale = (e?.locale || '').trim();
          if (locale) entry.locale = locale;
          const value_type = (e?.value_type || '').trim();
          if (value_type) entry.value_type = value_type;
          return entry;
        })
        .filter((e): e is PasoUiLabelEntry => !!e);
    };

    const labels: PasoUiLabels = {};
    const affirmative = collect(rawLabels.affirmative_action_label);
    const denial = collect(rawLabels.denial_action_label);
    const title = collect(rawLabels.transaction_title);
    const security = collect(rawLabels.security_hint);
    if (affirmative.length) labels.affirmative_action_label = affirmative;
    if (denial.length) labels.denial_action_label = denial;
    if (title.length) labels.transaction_title = title;
    if (security.length) labels.security_hint = security;

    return Object.keys(labels).length > 0 ? labels : undefined;
  }

  /**
   * Open JSON view dialog to show/edit the complete configuration
   */
  viewAsJson(): void {
    const currentConfig = this.buildConfigurationPayload();

    const dialogRef = this.dialog.open(JsonViewDialogComponent, {
      data: {
        title: 'Complete Configuration JSON',
        jsonData: currentConfig,
        readonly: false,
        schema: credentialConfigSchema,
      },
      disableClose: true,
      minWidth: '60vw',
      maxWidth: '95vw',
      maxHeight: '95vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadConfigurationFromJson(result);
      }
    });
  }

  /**
   * Build configuration payload from form values with proper JSON parsing
   */
  private buildConfigurationPayload(): any {
    const formValue = { ...this.form.value };
    formValue.id = this.route.snapshot.params['id'] || formValue.id;

    const isMdoc = formValue.format === 'mso_mdoc';

    formValue.config = {
      format: formValue.format,
      display: formValue.displayConfigs,
      scope: formValue.scope || undefined,
      // Key attestation requirements (if enabled)
      ...(formValue.keyAttestationEnabled && {
        keyAttestationsRequired: {
          key_storage: formValue.keyStorageTypes?.length ? formValue.keyStorageTypes : undefined,
          user_authentication: formValue.userAuthenticationTypes?.length
            ? formValue.userAuthenticationTypes
            : undefined,
        },
      }),
      // mDOC specific fields
      ...(isMdoc && {
        docType: formValue.docType || undefined,
      }),
    };

    formValue.fields = this.buildFieldsPayload(formValue.fields || [], isMdoc, formValue.namespace);

    // Convert empty strings to null to clear optional fields (for PATCH semantics)
    formValue.keyChainId = formValue.keyChainId || null;
    formValue.scope = formValue.scope || null;

    // SD-JWT specific fields (only include if SD-JWT format)
    if (isMdoc) {
      formValue.vct = null;
      formValue.sdJwtTrustFormat = null;
    } else {
      // Handle VCT based on mode:
      // - string mode: use custom URI entered by user
      // - object mode: send the metadata object (vct field inside will be auto-generated by backend)
      if (this.vctMode === 'string') {
        formValue.vct = formValue.vctString?.trim() || null;
      } else {
        formValue.vct = this.parseJsonField(formValue.vct, 'extract', true);
      }
      formValue.sdJwtTrustFormat = formValue.sdJwtTrustFormat || 'x5c';
    }

    formValue.embeddedDisclosurePolicy = this.parseJsonField(
      formValue.embeddedDisclosurePolicy,
      'extract',
      true
    );

    // Handle references - use null to clear
    formValue.attributeProviderId = formValue.attributeProviderId?.trim() || null;
    formValue.webhookEndpointId = formValue.webhookEndpointId?.trim() || null;

    // Handle iaeActions - use null to clear, or transform to proper format
    if (formValue.iaeActions?.length) {
      formValue.iaeActions = formValue.iaeActions.map((action: any) => {
        if (action.type === 'redirect_to_web') {
          return {
            type: action.type,
            label: action.label || undefined,
            url: action.url,
            callbackUrl: action.callbackUrl || undefined,
            description: action.description || undefined,
          };
        }
        return {
          type: action.type,
          label: action.label || undefined,
          presentationConfigId: action.presentationConfigId,
        };
      });
    } else {
      formValue.iaeActions = null;
    }

    // PASO transaction data types — collapse the form's nested array shape into
    // the backend's Record<urn, PasoTransactionDataTypeConfig>. Null clears.
    // IMPORTANT: never let the raw form-shaped paso (where transactionDataTypes
    // is an array) leak to the backend. The backend's @Transform on PasoConfig
    // would convert that array into an empty `{}` record, leaving the credential
    // in a paso-but-empty state that's invisible in the well-known metadata.
    formValue.paso = this.buildPasoPayload(formValue.paso);

    // Clean up form-only fields
    delete formValue.displayConfigs;
    delete formValue.vctString;
    delete formValue.format;
    delete formValue.docType;
    delete formValue.namespace;
    delete formValue.keyAttestationEnabled;
    delete formValue.keyStorageTypes;
    delete formValue.userAuthenticationTypes;

    return formValue;
  }

  /**
   * Helper to parse JSON fields with proper null/undefined handling
   * @param useNullForEmpty - if true, returns null for empty values (for PATCH to clear field)
   */
  private parseJsonField(
    value: any,
    mode: 'parse' | 'extract' = 'parse',
    useNullForEmpty = false
  ): any {
    if (!value || value === '') return useNullForEmpty ? null : undefined;
    if (typeof value !== 'string') return value;

    const parsed = JSON.parse(value);
    return mode === 'extract' ? extractSchema(value) : parsed;
  }

  private buildFieldsPayload(
    rawFields: any[],
    isMdoc: boolean,
    defaultNamespace?: string
  ): ClaimFieldDefinitionDto[] {
    return rawFields
      .map((rawField: any) => {
        const path = this.parseFieldPath(rawField['path']);
        const defaultValueRaw = rawField['defaultValue']?.trim();
        const namespace = rawField['namespace']?.trim() || defaultNamespace?.trim() || undefined;

        const field: ClaimFieldDefinitionDto = {
          path,
          type: rawField['type'],
          mandatory: !!rawField['mandatory'],
          ...(isMdoc ? {} : { disclosable: !!rawField['disclosable'] }),
          ...(namespace ? { namespace } : {}),
        };

        if (defaultValueRaw) {
          field.defaultValue = JSON.parse(defaultValueRaw);
        }

        const display = (rawField['display'] || [])
          .map((entry: any) => ({
            locale: entry['locale']?.trim() || entry['lang']?.trim(),
            name: entry['name']?.trim() || entry['label']?.trim(),
            description: entry['description']?.trim() || undefined,
          }))
          .filter((entry: FieldDisplayDto) => !!entry.locale && !!entry.name);

        if (display.length > 0) {
          field.display = display;
        }

        return field;
      })
      .filter((field) => field.path.length > 0);
  }

  private parseFieldPath(value: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  /**
   * Helper to stringify values for form fields
   */
  private stringifyField(value: any): string {
    return value ? JSON.stringify(value, null, 2) : '';
  }

  /**
   * Load configuration from JSON object into the form
   */
  private loadConfigurationFromJson(config: CredentialConfigCreate): void {
    try {
      this.patchFormFromConfig(config);

      this.snackBar.open('Configuration loaded from JSON successfully', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error loading configuration from JSON:', error);
      this.snackBar.open('Error loading configuration from JSON', 'Close', {
        duration: 3000,
      });
    }
  }

  /**
   * Load a predefined configuration
   */
  loadPredefinedConfig(configTemplate: any): void {
    const config = structuredClone(configTemplate.config);

    this.loadConfigurationFromJson(config);

    this.snackBar.open(`${configTemplate.name} template loaded successfully`, 'OK', {
      duration: 3000,
    });
  }

  /**
   * Show predefined configuration in JSON view (readonly)
   */
  previewPredefinedConfig(configTemplate: any): void {
    this.dialog.open(JsonViewDialogComponent, {
      data: {
        title: `${configTemplate.name} - Preview`,
        jsonData: configTemplate.config,
      },
      disableClose: false,
      maxWidth: '95vw',
      maxHeight: '95vh',
    });
  }
}
