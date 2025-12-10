import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { updatePlan, getPlanDetails } from '../../api';
import { Upload, FileText, Check, Building2, Hammer, Zap, Shield, Palette, DollarSign, Award } from 'lucide-react';

export default function UploadPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const searchParams = new URLSearchParams(location.search);
  const editingPlanId = searchParams.get('edit');
  const isEditMode = !!editingPlanId;

  // Section 1: Basic Information
  const planCategories = [
    'Mansion',
    'Bungalow',
    'Townhouse',
    'Duplex',
    'Apartment',
    'Villa',
    'Commercial Complex'
  ];

  const [basicInfo, setBasicInfo] = useState({
    name: '',
    project_type: 'Residential',
    category: '',
    description: '',
    target_audience: 'All'
  });

  // Section 2: Technical Specifications
  const [techSpecs, setTechSpecs] = useState({
    area: '',
    plot_size: '',
    bedrooms: '',
    bathrooms: '',
    floors: '',
    building_height: '',
    parking_spaces: '0',
    special_features: [] as string[]
  });

  // Section 3: Disciplines Included
  const [disciplines, setDisciplines] = useState({
    architectural: true,
    structural: false,
    mep: {
      mechanical: false,
      electrical: false,
      plumbing: false
    },
    civil: false,
    fire_safety: false,
    interior: false
  });

  // Section 4: File Uploads
  const [files, setFiles] = useState({
    architectural: [] as File[],
    structural: [] as File[],
    mep_mechanical: [] as File[],
    mep_electrical: [] as File[],
    mep_plumbing: [] as File[],
    civil: [] as File[],
    fire_safety: [] as File[],
    interior: [] as File[],
    renders: [] as File[],
    thumbnail: null as File | null,
    gallery: [] as File[]
  });

  // Section 5: BOQ & Costing
  const [boq, setBoq] = useState({
    includes_boq: false,
    boq_architectural: null as File | null,
    boq_structural: null as File | null,
    boq_mep: null as File | null,
    cost_summary: null as File | null,
    estimated_cost_min: '',
    estimated_cost_max: ''
  });

  // Section 6: Package Level
  const [packageLevel, setPackageLevel] = useState('basic');

  // Section 7: Compliance & Standards
  const [compliance, setCompliance] = useState({
    building_code: 'Kenya Building Code',
    certifications: [] as string[]
  });

  // Section 8: Pricing & Licensing
  const [pricing, setPricing] = useState({
    price: '',
    license_type: 'single_use',
    customization_available: false,
    support_duration: '0'
  });

  // Section 9: Additional Information
  const [additional, setAdditional] = useState({
    project_timeline_ref: '',
    material_specifications: '',
    construction_notes: ''
  });

  const specialFeaturesList = [
    'Swimming Pool', 'Basement', 'Penthouse', 'Rooftop Terrace', 
    'Gym', 'Home Office', 'Smart Home', 'Solar Panels', 
    'Rainwater Harvesting', 'Elevator', 'Servant Quarters', 'Garden'
  ];

  const certificationsList = [
    'Energy Efficient', 'Green Building', 'LEED Certified', 
    'Accessibility Compliant', 'Fire Safety Certified', 'Seismic Resistant'
  ];

  const handleFileChange = (category: string, fileList: FileList | null) => {
    if (!fileList) return;
    const fileArray = Array.from(fileList);
    setFiles(prev => ({ ...prev, [category]: fileArray }));
  };

  // Prefill when editing an existing plan
  useEffect(() => {
    if (!isEditMode || !editingPlanId) return;

    const loadPlan = async () => {
      try {
        const response = await getPlanDetails(editingPlanId);
        const plan = response.data;

        setBasicInfo({
          name: plan.name || '',
          project_type: plan.project_type || 'Residential',
          category: plan.category || '',
          description: plan.description || '',
          target_audience: plan.target_audience || 'All',
        });

        setTechSpecs({
          area: plan.area != null ? String(plan.area) : '',
          plot_size: plan.plot_size != null ? String(plan.plot_size) : '',
          bedrooms: plan.bedrooms != null ? String(plan.bedrooms) : '',
          bathrooms: plan.bathrooms != null ? String(plan.bathrooms) : '',
          floors: plan.floors != null ? String(plan.floors) : '',
          building_height: plan.building_height != null ? String(plan.building_height) : '',
          parking_spaces: plan.parking_spaces != null ? String(plan.parking_spaces) : '0',
          special_features: plan.special_features || [],
        });

        if (plan.disciplines_included) {
          setDisciplines(plan.disciplines_included);
        }

        setBoq({
          includes_boq: !!plan.includes_boq,
          boq_architectural: null,
          boq_structural: null,
          boq_mep: null,
          cost_summary: null,
          estimated_cost_min: plan.estimated_cost_min != null ? String(plan.estimated_cost_min) : '',
          estimated_cost_max: plan.estimated_cost_max != null ? String(plan.estimated_cost_max) : '',
        });

        setPackageLevel(plan.package_level || 'basic');

        setCompliance({
          building_code: plan.building_code || 'Kenya Building Code',
          certifications: plan.certifications || [],
        });

        setPricing({
          price: plan.price != null ? String(plan.price) : '',
          license_type: plan.license_type || 'single_use',
          customization_available: !!plan.customization_available,
          support_duration: plan.support_duration != null ? String(plan.support_duration) : '0',
        });

        setAdditional({
          project_timeline_ref: plan.project_timeline_ref || '',
          material_specifications: plan.material_specifications || '',
          construction_notes: plan.construction_notes || '',
        });
      } catch (err) {
        console.error('Failed to load plan for editing', err);
      }
    };

    loadPlan();
  }, [isEditMode, editingPlanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // Basic Info
      Object.entries(basicInfo).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });

      // Technical Specs
      Object.entries(techSpecs).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          formDataToSend.append(key, JSON.stringify(value));
        } else {
          formDataToSend.append(key, value);
        }
      });

      // Disciplines
      formDataToSend.append('disciplines_included', JSON.stringify(disciplines));

      // BOQ
      formDataToSend.append('includes_boq', boq.includes_boq.toString());
      formDataToSend.append('estimated_cost_min', boq.estimated_cost_min);
      formDataToSend.append('estimated_cost_max', boq.estimated_cost_max);

      // Package & Compliance
      formDataToSend.append('package_level', packageLevel);
      formDataToSend.append('building_code', compliance.building_code);
      formDataToSend.append('certifications', JSON.stringify(compliance.certifications));

      // Pricing
      Object.entries(pricing).forEach(([key, value]) => {
        formDataToSend.append(key, value.toString());
      });

      // Additional
      Object.entries(additional).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });

      // Files - Architectural
      if (disciplines.architectural) {
        files.architectural.forEach(file => {
          formDataToSend.append('architectural_files', file);
        });
      }

      // Files - Structural
      if (disciplines.structural) {
        files.structural.forEach(file => {
          formDataToSend.append('structural_files', file);
        });
      }

      // Files - MEP
      if (disciplines.mep.mechanical) {
        files.mep_mechanical.forEach(file => {
          formDataToSend.append('mep_mechanical_files', file);
        });
      }
      if (disciplines.mep.electrical) {
        files.mep_electrical.forEach(file => {
          formDataToSend.append('mep_electrical_files', file);
        });
      }
      if (disciplines.mep.plumbing) {
        files.mep_plumbing.forEach(file => {
          formDataToSend.append('mep_plumbing_files', file);
        });
      }

      // Files - Other Disciplines
      if (disciplines.civil) {
        files.civil.forEach(file => {
          formDataToSend.append('civil_files', file);
        });
      }
      if (disciplines.fire_safety) {
        files.fire_safety.forEach(file => {
          formDataToSend.append('fire_safety_files', file);
        });
      }
      if (disciplines.interior) {
        files.interior.forEach(file => {
          formDataToSend.append('interior_files', file);
        });
      }

      // 3D Renders
      files.renders.forEach(file => {
        formDataToSend.append('renders', file);
      });

      // BOQ Files
      if (boq.includes_boq) {
        if (boq.boq_architectural) formDataToSend.append('boq_architectural', boq.boq_architectural);
        if (boq.boq_structural) formDataToSend.append('boq_structural', boq.boq_structural);
        if (boq.boq_mep) formDataToSend.append('boq_mep', boq.boq_mep);
        if (boq.cost_summary) formDataToSend.append('cost_summary', boq.cost_summary);
      }

      // Images
      if (files.thumbnail) formDataToSend.append('thumbnail', files.thumbnail);
      files.gallery.forEach(file => {
        formDataToSend.append('gallery', file);
      });

      if (isEditMode && editingPlanId) {
        await updatePlan(editingPlanId, formDataToSend);
        alert('Plan updated successfully!');
      } else {
        await api.post('/plans/upload', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        alert('Professional plan uploaded successfully!');
      }
      navigate('/designer/my-plans');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload plan');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Building2 className="w-6 h-6 text-blue-600" />
        Basic Information
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plan Name *
        </label>
        <input
          type="text"
          value={basicInfo.name}
          onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})}
          className="input-field"
          placeholder="e.g., Modern 4-Bedroom Villa"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Type *
          </label>
          <select
            value={basicInfo.project_type}
            onChange={(e) => setBasicInfo({...basicInfo, project_type: e.target.value})}
            className="input-field"
          >
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Industrial">Industrial</option>
            <option value="Institutional">Institutional (Schools, Hospitals)</option>
            <option value="Mixed-Use">Mixed-Use</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plan Category *
          </label>
          <select
            value={basicInfo.category}
            onChange={(e) => setBasicInfo({...basicInfo, category: e.target.value})}
            className="input-field"
            required
          >
            <option value="" disabled>
              Select what you are listing (e.g. Mansion, Bungalow)
            </option>
            {planCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Audience *
          </label>
          <select
            value={basicInfo.target_audience}
            onChange={(e) => setBasicInfo({...basicInfo, target_audience: e.target.value})}
            className="input-field"
          >
            <option value="All">All</option>
            <option value="Homeowner">Homeowner / Self-Builder</option>
            <option value="Contractor">Contractor / Builder</option>
            <option value="Developer">Developer / Investor</option>
            <option value="Professional">Professional (Architects/Engineers)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description *
        </label>
        <textarea
          value={basicInfo.description}
          onChange={(e) => setBasicInfo({...basicInfo, description: e.target.value})}
          className="input-field"
          rows={4}
          placeholder="Describe the plan, key features, design philosophy..."
          required
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Hammer className="w-6 h-6 text-orange-600" />
        Technical Specifications
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Area (m²) *</label>
          <input
            type="number"
            value={techSpecs.area}
            onChange={(e) => setTechSpecs({...techSpecs, area: e.target.value})}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plot Size (m²)</label>
          <input
            type="number"
            value={techSpecs.plot_size}
            onChange={(e) => setTechSpecs({...techSpecs, plot_size: e.target.value})}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
          <input
            type="number"
            value={techSpecs.bedrooms}
            onChange={(e) => setTechSpecs({...techSpecs, bedrooms: e.target.value})}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
          <input
            type="number"
            value={techSpecs.bathrooms}
            onChange={(e) => setTechSpecs({...techSpecs, bathrooms: e.target.value})}
            className="input-field"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Floors/Stories *</label>
          <input
            type="number"
            value={techSpecs.floors}
            onChange={(e) => setTechSpecs({...techSpecs, floors: e.target.value})}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Building Height (m)</label>
          <input
            type="number"
            step="0.1"
            value={techSpecs.building_height}
            onChange={(e) => setTechSpecs({...techSpecs, building_height: e.target.value})}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parking Spaces</label>
          <input
            type="number"
            value={techSpecs.parking_spaces}
            onChange={(e) => setTechSpecs({...techSpecs, parking_spaces: e.target.value})}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Special Features
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {specialFeaturesList.map(feature => (
            <label key={feature} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={techSpecs.special_features.includes(feature)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setTechSpecs({...techSpecs, special_features: [...techSpecs.special_features, feature]});
                  } else {
                    setTechSpecs({...techSpecs, special_features: techSpecs.special_features.filter(f => f !== feature)});
                  }
                }}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">{feature}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <FileText className="w-6 h-6 text-purple-600" />
        Disciplines Included
      </h3>
      <p className="text-sm text-gray-600">Select which construction disciplines are included in this plan package</p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors" 
               style={{borderColor: disciplines.architectural ? '#3b82f6' : '#e5e7eb'}}>
          <input
            type="checkbox"
            checked={disciplines.architectural}
            onChange={(e) => setDisciplines({...disciplines, architectural: e.target.checked})}
            className="w-5 h-5 text-blue-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Architectural Plans</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">REQUIRED</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Floor plans, elevations, sections, roof plans, site plans</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-green-50 transition-colors"
               style={{borderColor: disciplines.structural ? '#10b981' : '#e5e7eb'}}>
          <input
            type="checkbox"
            checked={disciplines.structural}
            onChange={(e) => setDisciplines({...disciplines, structural: e.target.checked})}
            className="w-5 h-5 text-green-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Hammer className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-900">Structural Plans</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Foundation, framing, reinforcement details, structural schedules</p>
          </div>
        </label>

        <div className="border-2 rounded-lg p-4" style={{borderColor: Object.values(disciplines.mep).some(v => v) ? '#f59e0b' : '#e5e7eb'}}>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-gray-900">MEP Plans (Mechanical, Electrical, Plumbing)</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Select specific MEP disciplines below:</p>
            </div>
          </label>
          
          <div className="mt-3 ml-8 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={disciplines.mep.mechanical}
                onChange={(e) => setDisciplines({...disciplines, mep: {...disciplines.mep, mechanical: e.target.checked}})}
                className="rounded text-amber-600"
              />
              <span className="text-sm text-gray-700">Mechanical (HVAC, Ventilation)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={disciplines.mep.electrical}
                onChange={(e) => setDisciplines({...disciplines, mep: {...disciplines.mep, electrical: e.target.checked}})}
                className="rounded text-amber-600"
              />
              <span className="text-sm text-gray-700">Electrical (Power, Lighting, Low Voltage)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={disciplines.mep.plumbing}
                onChange={(e) => setDisciplines({...disciplines, mep: {...disciplines.mep, plumbing: e.target.checked}})}
                className="rounded text-amber-600"
              />
              <span className="text-sm text-gray-700">Plumbing (Water, Drainage, Sewerage)</span>
            </label>
          </div>
        </div>

        <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
               style={{borderColor: disciplines.civil ? '#6b7280' : '#e5e7eb'}}>
          <input
            type="checkbox"
            checked={disciplines.civil}
            onChange={(e) => setDisciplines({...disciplines, civil: e.target.checked})}
            className="w-5 h-5 text-gray-600"
          />
          <div className="flex-1">
            <span className="font-semibold text-gray-900">Civil/Infrastructure Plans</span>
            <p className="text-sm text-gray-600 mt-1">Roads, parking, stormwater drainage, external works</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
               style={{borderColor: disciplines.fire_safety ? '#ef4444' : '#e5e7eb'}}>
          <input
            type="checkbox"
            checked={disciplines.fire_safety}
            onChange={(e) => setDisciplines({...disciplines, fire_safety: e.target.checked})}
            className="w-5 h-5 text-red-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-gray-900">Fire & Life Safety Plans</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Fire exits, extinguishers, alarms, sprinklers, emergency lighting</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-pink-50 transition-colors"
               style={{borderColor: disciplines.interior ? '#ec4899' : '#e5e7eb'}}>
          <input
            type="checkbox"
            checked={disciplines.interior}
            onChange={(e) => setDisciplines({...disciplines, interior: e.target.checked})}
            className="w-5 h-5 text-pink-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-pink-600" />
              <span className="font-semibold text-gray-900">Interior Design Package</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Material boards, color schemes, furniture layouts, finishes</p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Upload className="w-6 h-6 text-indigo-600" />
        File Uploads
      </h3>
      <p className="text-sm text-gray-600">Upload plan files for each selected discipline (PDF, DWG, or ZIP)</p>

      {disciplines.architectural && (
        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            📐 Architectural Plans * (Required)
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('architectural', e.target.files)}
            className="input-field"
            required
          />
          <p className="text-xs text-gray-600 mt-1">
            Upload: Floor plans, elevations, sections, roof plans, site plans
          </p>
        </div>
      )}

      {disciplines.structural && (
        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            🏗️ Structural Plans
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('structural', e.target.files)}
            className="input-field"
          />
          <p className="text-xs text-gray-600 mt-1">
            Upload: Foundation, framing, reinforcement details, schedules
          </p>
        </div>
      )}

      {disciplines.mep.mechanical && (
        <div className="bg-amber-50 p-4 rounded-lg border-2 border-amber-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            ❄️ Mechanical Plans (HVAC)
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('mep_mechanical', e.target.files)}
            className="input-field"
          />
        </div>
      )}

      {disciplines.mep.electrical && (
        <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            ⚡ Electrical Plans
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('mep_electrical', e.target.files)}
            className="input-field"
          />
        </div>
      )}

      {disciplines.mep.plumbing && (
        <div className="bg-cyan-50 p-4 rounded-lg border-2 border-cyan-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            💧 Plumbing Plans
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('mep_plumbing', e.target.files)}
            className="input-field"
          />
        </div>
      )}

      {disciplines.civil && (
        <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-300">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            🛣️ Civil/Infrastructure Plans
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('civil', e.target.files)}
            className="input-field"
          />
        </div>
      )}

      {disciplines.fire_safety && (
        <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            🚨 Fire & Safety Plans
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip"
            onChange={(e) => handleFileChange('fire_safety', e.target.files)}
            className="input-field"
          />
        </div>
      )}

      {disciplines.interior && (
        <div className="bg-pink-50 p-4 rounded-lg border-2 border-pink-200">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            🎨 Interior Design Package
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.zip,.jpg,.png"
            onChange={(e) => handleFileChange('interior', e.target.files)}
            className="input-field"
          />
        </div>
      )}

      <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          🎬 3D Renders / Visualizations (Optional)
        </label>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={(e) => handleFileChange('renders', e.target.files)}
          className="input-field"
        />
      </div>

      <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          🖼️ Thumbnail Image * (Required)
        </label>
        <input
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={(e) => setFiles({...files, thumbnail: e.target.files?.[0] || null})}
          className="input-field"
          required
        />
        <p className="text-xs text-gray-600 mt-1">Main image shown in browse plans (JPG/PNG, max 5MB)</p>
      </div>

      <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          🖼️ Gallery Images (Optional, max 10)
        </label>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png"
          onChange={(e) => handleFileChange('gallery', e.target.files)}
          className="input-field"
        />
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-emerald-600" />
        BOQ & Cost Estimation
      </h3>

      <label className="flex items-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg cursor-pointer">
        <input
          type="checkbox"
          checked={boq.includes_boq}
          onChange={(e) => setBoq({...boq, includes_boq: e.target.checked})}
          className="w-5 h-5 text-emerald-600"
        />
        <div>
          <span className="font-semibold text-gray-900">Include Bill of Quantities (BOQ)</span>
          <p className="text-sm text-gray-600">Detailed quantities and cost breakdown for construction</p>
        </div>
      </label>

      {boq.includes_boq && (
        <div className="space-y-4 ml-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📊 Architectural BOQ (Excel/PDF)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => setBoq({...boq, boq_architectural: e.target.files?.[0] || null})}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🏗️ Structural BOQ (Excel/PDF)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => setBoq({...boq, boq_structural: e.target.files?.[0] || null})}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ⚡ MEP BOQ (Excel/PDF)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => setBoq({...boq, boq_mep: e.target.files?.[0] || null})}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              💰 Cost Summary (Excel/PDF)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => setBoq({...boq, cost_summary: e.target.files?.[0] || null})}
              className="input-field"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Cost (Min) - KSH
          </label>
          <input
            type="number"
            value={boq.estimated_cost_min}
            onChange={(e) => setBoq({...boq, estimated_cost_min: e.target.value})}
            className="input-field"
            placeholder="e.g., 3500000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Cost (Max) - KSH
          </label>
          <input
            type="number"
            value={boq.estimated_cost_max}
            onChange={(e) => setBoq({...boq, estimated_cost_max: e.target.value})}
            className="input-field"
            placeholder="e.g., 4200000"
          />
        </div>
      </div>
      <p className="text-sm text-gray-600">Provide a cost range to help buyers understand budget requirements</p>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Award className="w-6 h-6 text-purple-600" />
        Package Level & Compliance
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Package Level *
        </label>
        <div className="space-y-3">
          {[
            {value: 'basic', label: 'Basic', desc: 'Architectural plans only', badge: 'KSH 5K-15K'},
            {value: 'standard', label: 'Standard', desc: 'Architectural + Structural', badge: 'KSH 15K-30K'},
            {value: 'premium', label: 'Premium', desc: 'Arch + Struct + MEP + BOQ', badge: 'KSH 30K-60K'},
            {value: 'complete', label: 'Complete', desc: 'Everything (All disciplines + Interior + Civil + Fire)', badge: 'KSH 60K+'}
          ].map(pkg => (
            <label key={pkg.value} 
                   className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors"
                   style={{borderColor: packageLevel === pkg.value ? '#9333ea' : '#e5e7eb'}}>
              <input
                type="radio"
                name="package"
                value={pkg.value}
                checked={packageLevel === pkg.value}
                onChange={(e) => setPackageLevel(e.target.value)}
                className="w-4 h-4 text-purple-600"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{pkg.label}</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{pkg.badge}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{pkg.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Building Code Compliance *
        </label>
        <select
          value={compliance.building_code}
          onChange={(e) => setCompliance({...compliance, building_code: e.target.value})}
          className="input-field"
        >
          <option value="Kenya Building Code">Kenya Building Code</option>
          <option value="IBC (International Building Code)">IBC (International Building Code)</option>
          <option value="Eurocode">Eurocode</option>
          <option value="British Standards (BS)">British Standards (BS)</option>
          <option value="Other">Other/Custom</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Certifications & Standards
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {certificationsList.map(cert => (
            <label key={cert} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={compliance.certifications.includes(cert)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setCompliance({...compliance, certifications: [...compliance.certifications, cert]});
                  } else {
                    setCompliance({...compliance, certifications: compliance.certifications.filter(c => c !== cert)});
                  }
                }}
                className="rounded text-purple-600"
              />
              <span className="text-sm text-gray-700">{cert}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-green-600" />
        Pricing & Licensing
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Base Price (KSH) *
        </label>
        <input
          type="number"
          value={pricing.price}
          onChange={(e) => setPricing({...pricing, price: e.target.value})}
          className="input-field"
          placeholder="e.g., 25000"
          required
        />
        <p className="text-sm text-gray-500 mt-1">Set your selling price for this plan package</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          License Type *
        </label>
        <div className="space-y-3">
          {[
            {value: 'single_use', label: 'Single Use', desc: 'One-time construction only'},
            {value: 'multiple_use', label: 'Multiple Use', desc: 'Up to 5 constructions'},
            {value: 'commercial', label: 'Commercial License', desc: 'Unlimited constructions'}
          ].map(lic => (
            <label key={lic.value} 
                   className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-green-50 transition-colors"
                   style={{borderColor: pricing.license_type === lic.value ? '#10b981' : '#e5e7eb'}}>
              <input
                type="radio"
                name="license"
                value={lic.value}
                checked={pricing.license_type === lic.value}
                onChange={(e) => setPricing({...pricing, license_type: e.target.value})}
                className="w-4 h-4 text-green-600"
              />
              <div className="flex-1">
                <span className="font-semibold text-gray-900">{lic.label}</span>
                <p className="text-sm text-gray-600 mt-1">{lic.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pricing.customization_available}
            onChange={(e) => setPricing({...pricing, customization_available: e.target.checked})}
            className="rounded text-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">Customization Services Available</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Support/Revision Duration (months)
          </label>
          <input
            type="number"
            value={pricing.support_duration}
            onChange={(e) => setPricing({...pricing, support_duration: e.target.value})}
            className="input-field"
            placeholder="e.g., 3"
          />
          <p className="text-sm text-gray-500 mt-1">How long will you provide support/revisions after purchase?</p>
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">
        Additional Information (Optional)
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Project Timeline Reference
        </label>
        <textarea
          value={additional.project_timeline_ref}
          onChange={(e) => setAdditional({...additional, project_timeline_ref: e.target.value})}
          className="input-field"
          rows={3}
          placeholder="e.g., Typical construction: 8-12 months"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Material Specifications
        </label>
        <textarea
          value={additional.material_specifications}
          onChange={(e) => setAdditional({...additional, material_specifications: e.target.value})}
          className="input-field"
          rows={4}
          placeholder="Key materials specified: concrete grade, steel type, roofing, finishes..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Construction Notes
        </label>
        <textarea
          value={additional.construction_notes}
          onChange={(e) => setAdditional({...additional, construction_notes: e.target.value})}
          className="input-field"
          rows={4}
          placeholder="Any special construction notes, site requirements, or recommendations..."
        />
      </div>
    </div>
  );

  const steps = [
    {num: 1, title: 'Basic Info', render: renderStep1},
    {num: 2, title: 'Tech Specs', render: renderStep2},
    {num: 3, title: 'Disciplines', render: renderStep3},
    {num: 4, title: 'Files', render: renderStep4},
    {num: 5, title: 'BOQ & Costing', render: renderStep5},
    {num: 6, title: 'Package & Compliance', render: renderStep6},
    {num: 7, title: 'Pricing', render: renderStep7},
    {num: 8, title: 'Additional', render: renderStep8}
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <Upload className="w-10 h-10 text-purple-600" />
            Professional Plan Upload
          </h1>
          <p className="text-gray-600">Complete construction documentation system for The Plancave marketplace</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 bg-white rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    currentStep === step.num 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white scale-110 shadow-lg' 
                      : currentStep > step.num
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {currentStep > step.num ? <Check className="w-5 h-5" /> : step.num}
                  </div>
                  <span className="text-xs font-medium text-gray-600 mt-2">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-2 ${currentStep > step.num ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit}>
            {steps[currentStep - 1].render()}

            <div className="flex justify-between mt-8 pt-6 border-t">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-all"
                >
                  ← Previous
                </button>
              )}
              
              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="ml-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg font-semibold transition-all"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-auto px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? '⏳ Uploading...' : '🚀 Upload Plan'}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            Cancel and return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
