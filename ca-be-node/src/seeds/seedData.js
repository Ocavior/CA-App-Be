const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const InsuranceCategory = require('../models/InsuranceCategory');
const InsuranceProduct = require('../models/InsuranceProduct');
const InsuranceProvider = require('../models/InsuranceProvider');
const Policy = require('../models/Policy');
const FormConfig = require('../models/FormConfig');
const Job = require('../models/Job');
const CompanyInfo = require('../models/CompanyInfo');
const Location = require('../models/Location');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed Users
const seedUsers = async () => {
  try {
    await User.deleteMany({});
    
    const users = [
      {
        name: 'Admin User',
        email: 'admin@arhamsecure.com',
        password: 'Admin@123',
        phone: '+91-9876543210',
        role: 'admin',
        isActive: true,
      },
      {
        name: 'Agent Kumar',
        email: 'agent@arhamsecure.com',
        password: 'Agent@123',
        phone: '+91-9876543211',
        role: 'agent',
        isActive: true,
      },
      {
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        password: 'User@123',
        phone: '+91-9876543212',
        role: 'user',
        isActive: true,
      },
      {
        name: 'Priya Singh',
        email: 'priya@example.com',
        password: 'User@123',
        phone: '+91-9876543213',
        role: 'user',
        isActive: true,
      },
    ];

    const createdUsers = await User.create(users);
    console.log('✅ Users seeded:', createdUsers.length);
    return createdUsers;
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
};

// Seed Insurance Categories
const seedCategories = async () => {
  try {
    await InsuranceCategory.deleteMany({});

    const categories = [
      {
        name: 'Health Insurance',
        key: 'health',
        description: 'Comprehensive health coverage for individuals and families',
        icon: 'hospital',
        isActive: true,
        displayOrder: 1,
      },
      {
        name: 'Life Insurance',
        key: 'life',
        description: 'Secure your family\'s financial future',
        icon: 'shield',
        isActive: true,
        displayOrder: 2,
      },
      {
        name: 'Motor Insurance',
        key: 'motor',
        description: 'Complete protection for your vehicle',
        icon: 'car',
        isActive: true,
        displayOrder: 3,
      },
      {
        name: 'Travel Insurance',
        key: 'travel',
        description: 'Travel worry-free with comprehensive coverage',
        icon: 'plane',
        isActive: true,
        displayOrder: 4,
      },
      {
        name: 'Home Insurance',
        key: 'home',
        description: 'Protect your home and belongings',
        icon: 'home',
        isActive: true,
        displayOrder: 5,
      },
      {
        name: 'Group Insurance',
        key: 'group',
        description: 'Corporate insurance solutions for employees',
        icon: 'users',
        isActive: true,
        displayOrder: 6,
      },
    ];

    const createdCategories = await InsuranceCategory.create(categories);
    console.log('✅ Categories seeded:', createdCategories.length);
    return createdCategories;
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

// Seed Insurance Products
const seedProducts = async (categories) => {
  try {
    await InsuranceProduct.deleteMany({});

    const healthCategory = categories.find(c => c.key === 'health');
    const lifeCategory = categories.find(c => c.key === 'life');
    const motorCategory = categories.find(c => c.key === 'motor');
    const travelCategory = categories.find(c => c.key === 'travel');
    const homeCategory = categories.find(c => c.key === 'home');
    const groupCategory = categories.find(c => c.key === 'group');

    const products = [
      // Health Insurance Products
      {
        name: 'Individual Health Plan',
        category: healthCategory._id,
        description: 'Comprehensive health coverage for individuals',
        shortDescription: 'Complete health protection for you',
        features: [
          'Cashless hospitalization',
          'Pre and post hospitalization',
          'Day care procedures',
          'No claim bonus',
        ],
        benefits: [
          'Coverage up to ₹25 Lakhs',
          'Lifetime renewability',
          'Tax benefits under 80D',
          'Free health check-ups',
        ],
        coverageAmount: {
          min: 300000,
          max: 2500000,
        },
        premium: {
          starting: 5000,
          currency: 'INR',
        },
        icon: 'user-shield',
        isActive: true,
      },
      {
        name: 'Family Floater Health Plan',
        category: healthCategory._id,
        description: 'Single policy covering entire family',
        shortDescription: 'One plan for whole family',
        features: [
          'Covers entire family',
          'Maternity coverage',
          'New born baby coverage',
          'Vaccination coverage',
        ],
        benefits: [
          'Coverage up to ₹50 Lakhs',
          'No limit on family members',
          'Shared sum insured',
          'Pre-existing disease cover',
        ],
        coverageAmount: {
          min: 500000,
          max: 5000000,
        },
        premium: {
          starting: 12000,
          currency: 'INR',
        },
        icon: 'users',
        isActive: true,
      },
      {
        name: 'Senior Citizen Health Plan',
        category: healthCategory._id,
        description: 'Specialized health coverage for seniors',
        shortDescription: 'Health protection for age 60+',
        features: [
          'No medical tests required',
          'Critical illness coverage',
          'Home care treatment',
          'OPD coverage',
        ],
        benefits: [
          'Entry age up to 80 years',
          'Coverage for pre-existing conditions',
          'Renewal for lifetime',
          'Daily hospital cash',
        ],
        coverageAmount: {
          min: 200000,
          max: 1000000,
        },
        premium: {
          starting: 15000,
          currency: 'INR',
        },
        icon: 'user-clock',
        isActive: true,
      },

      // Life Insurance Products
      {
        name: 'Term Life Insurance',
        category: lifeCategory._id,
        description: 'Pure life protection at affordable rates',
        shortDescription: 'Maximum coverage, minimum premium',
        features: [
          'High coverage at low cost',
          'Flexible policy terms',
          'Multiple payout options',
          'Tax benefits',
        ],
        benefits: [
          'Coverage up to ₹2 Crores',
          'Optional riders available',
          'Critical illness cover',
          'Accidental death benefit',
        ],
        coverageAmount: {
          min: 2500000,
          max: 20000000,
        },
        premium: {
          starting: 8000,
          currency: 'INR',
        },
        icon: 'shield-alt',
        isActive: true,
      },
      {
        name: 'Whole Life Insurance',
        category: lifeCategory._id,
        description: 'Lifetime protection with savings',
        shortDescription: 'Protection till age 100',
        features: [
          'Lifetime coverage',
          'Maturity benefits',
          'Loan facility',
          'Bonus accumulation',
        ],
        benefits: [
          'Guaranteed returns',
          'Tax-free maturity',
          'Survival benefits',
          'Death benefit to nominee',
        ],
        coverageAmount: {
          min: 1000000,
          max: 10000000,
        },
        premium: {
          starting: 25000,
          currency: 'INR',
        },
        icon: 'infinity',
        isActive: true,
      },

      // Motor Insurance Products
      {
        name: 'Comprehensive Car Insurance',
        category: motorCategory._id,
        description: 'Complete protection for your car',
        shortDescription: 'All-in-one car coverage',
        features: [
          'Own damage coverage',
          'Third party liability',
          'Personal accident cover',
          'Zero depreciation',
        ],
        benefits: [
          'Cashless garage network',
          'Roadside assistance',
          'No claim bonus',
          'Engine protection',
        ],
        coverageAmount: {
          min: 500000,
          max: 10000000,
        },
        premium: {
          starting: 12000,
          currency: 'INR',
        },
        icon: 'car',
        isActive: true,
      },
      {
        name: 'Two Wheeler Insurance',
        category: motorCategory._id,
        description: 'Complete bike and scooter protection',
        shortDescription: 'Bike/Scooter coverage',
        features: [
          'Third party cover',
          'Own damage protection',
          'Personal accident',
          'Theft coverage',
        ],
        benefits: [
          'Affordable premiums',
          'Quick claim settlement',
          'Pan India coverage',
          'Add-on covers available',
        ],
        coverageAmount: {
          min: 100000,
          max: 500000,
        },
        premium: {
          starting: 2000,
          currency: 'INR',
        },
        icon: 'motorcycle',
        isActive: true,
      },

      // Travel Insurance Products
      {
        name: 'International Travel Insurance',
        category: travelCategory._id,
        description: 'Comprehensive coverage for overseas travel',
        shortDescription: 'Travel abroad worry-free',
        features: [
          'Medical expenses abroad',
          'Trip cancellation',
          'Baggage loss',
          'Passport loss',
        ],
        benefits: [
          'Emergency medical evacuation',
          '24/7 assistance',
          'Adventure sports cover',
          'COVID-19 coverage',
        ],
        coverageAmount: {
          min: 500000,
          max: 10000000,
        },
        premium: {
          starting: 3000,
          currency: 'INR',
        },
        icon: 'plane-departure',
        isActive: true,
      },
      {
        name: 'Domestic Travel Insurance',
        category: travelCategory._id,
        description: 'Coverage for travel within India',
        shortDescription: 'Explore India safely',
        features: [
          'Medical emergencies',
          'Trip delays',
          'Baggage protection',
          'Personal liability',
        ],
        benefits: [
          'Affordable rates',
          'Instant policy',
          'Family plans available',
          'Trip interruption cover',
        ],
        coverageAmount: {
          min: 100000,
          max: 1000000,
        },
        premium: {
          starting: 500,
          currency: 'INR',
        },
        icon: 'map-marked-alt',
        isActive: true,
      },

      // Home Insurance Products
      {
        name: 'Home Structure Insurance',
        category: homeCategory._id,
        description: 'Protect your home structure',
        shortDescription: 'Building protection',
        features: [
          'Fire coverage',
          'Natural calamities',
          'Earthquake protection',
          'Terrorism cover',
        ],
        benefits: [
          'Rebuilding costs covered',
          'Alternative accommodation',
          'Architect fees',
          'Debris removal',
        ],
        coverageAmount: {
          min: 1000000,
          max: 50000000,
        },
        premium: {
          starting: 8000,
          currency: 'INR',
        },
        icon: 'home',
        isActive: true,
      },
      {
        name: 'Home Contents Insurance',
        category: homeCategory._id,
        description: 'Coverage for household items',
        shortDescription: 'Protect your belongings',
        features: [
          'Furniture coverage',
          'Electronics protection',
          'Jewelry insurance',
          'Theft coverage',
        ],
        benefits: [
          'New for old cover',
          'Worldwide coverage',
          'Credit card fraud',
          'Personal liability',
        ],
        coverageAmount: {
          min: 200000,
          max: 5000000,
        },
        premium: {
          starting: 3000,
          currency: 'INR',
        },
        icon: 'couch',
        isActive: true,
      },

      // Group Insurance Products
      {
        name: 'Group Health Insurance',
        category: groupCategory._id,
        description: 'Employee health coverage',
        shortDescription: 'Corporate health plans',
        features: [
          'Cashless hospitalization',
          'Pre-existing disease cover',
          'Maternity benefits',
          'Dental coverage',
        ],
        benefits: [
          'No medical tests',
          'Day one coverage',
          'Flexible sum insured',
          'Parent coverage option',
        ],
        coverageAmount: {
          min: 200000,
          max: 1000000,
        },
        premium: {
          starting: 4000,
          currency: 'INR',
        },
        icon: 'user-friends',
        isActive: true,
      },
      {
        name: 'Group Term Life Insurance',
        category: groupCategory._id,
        description: 'Life coverage for employees',
        shortDescription: 'Corporate term plans',
        features: [
          'Death benefit',
          'Accidental death cover',
          'Terminal illness benefit',
          'No medical tests',
        ],
        benefits: [
          'Affordable group rates',
          'Instant coverage',
          'Easy enrollment',
          'Optional spouse cover',
        ],
        coverageAmount: {
          min: 500000,
          max: 5000000,
        },
        premium: {
          starting: 2000,
          currency: 'INR',
        },
        icon: 'briefcase',
        isActive: true,
      },
    ];

    const createdProducts = await InsuranceProduct.create(products);
    console.log('✅ Products seeded:', createdProducts.length);
    return createdProducts;
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  }
};

// Seed Insurance Providers
const seedProviders = async () => {
  try {
    await InsuranceProvider.deleteMany({});

    const providers = [
      {
        name: 'HDFC ERGO',
        description: 'One of India\'s leading private general insurance companies',
        logo: 'https://example.com/logos/hdfc-ergo.png',
        website: 'https://www.hdfcergo.com',
        contactEmail: 'care@hdfcergo.com',
        contactPhone: '1800-2700-700',
        rating: 4.5,
        establishedYear: 2002,
        headquarters: 'Mumbai, Maharashtra',
        claimSettlementRatio: 95.2,
        specialties: ['Health', 'Motor', 'Travel', 'Home'],
        isActive: true,
      },
      {
        name: 'ICICI Lombard',
        description: 'Leading private sector general insurance company',
        logo: 'https://example.com/logos/icici-lombard.png',
        website: 'https://www.icicilombard.com',
        contactEmail: 'customersupport@icicilombard.com',
        contactPhone: '1800-2666',
        rating: 4.4,
        establishedYear: 2001,
        headquarters: 'Mumbai, Maharashtra',
        claimSettlementRatio: 94.8,
        specialties: ['Health', 'Motor', 'Travel'],
        isActive: true,
      },
      {
        name: 'Max Life Insurance',
        description: 'Leading life insurance company in India',
        logo: 'https://example.com/logos/max-life.png',
        website: 'https://www.maxlifeinsurance.com',
        contactEmail: 'customercare@maxlifeinsurance.com',
        contactPhone: '1860-120-5577',
        rating: 4.6,
        establishedYear: 2000,
        headquarters: 'New Delhi, Delhi',
        claimSettlementRatio: 99.35,
        specialties: ['Life', 'Term', 'Savings'],
        isActive: true,
      },
      {
        name: 'SBI General Insurance',
        description: 'Trusted general insurance from State Bank of India',
        logo: 'https://example.com/logos/sbi-general.png',
        website: 'https://www.sbigeneral.in',
        contactEmail: 'customersupport@sbigeneral.in',
        contactPhone: '1800-102-9090',
        rating: 4.3,
        establishedYear: 2009,
        headquarters: 'Mumbai, Maharashtra',
        claimSettlementRatio: 93.5,
        specialties: ['Health', 'Motor', 'Home', 'Travel'],
        isActive: true,
      },
      {
        name: 'Bajaj Allianz',
        description: 'Joint venture between Bajaj Finserv and Allianz SE',
        logo: 'https://example.com/logos/bajaj-allianz.png',
        website: 'https://www.bajajallianz.com',
        contactEmail: 'bagichelp@bajajallianz.co.in',
        contactPhone: '1800-209-0144',
        rating: 4.5,
        establishedYear: 2001,
        headquarters: 'Pune, Maharashtra',
        claimSettlementRatio: 96.1,
        specialties: ['Health', 'Motor', 'Travel', 'Home'],
        isActive: true,
      },
      {
        name: 'LIC (Life Insurance Corporation)',
        description: 'India\'s largest and most trusted life insurer',
        logo: 'https://example.com/logos/lic.png',
        website: 'https://www.licindia.in',
        contactEmail: 'customer@licindia.com',
        contactPhone: '022-68276827',
        rating: 4.7,
        establishedYear: 1956,
        headquarters: 'Mumbai, Maharashtra',
        claimSettlementRatio: 98.62,
        specialties: ['Life', 'Term', 'Pension', 'Savings'],
        isActive: true,
      },
    ];

    const createdProviders = await InsuranceProvider.create(providers);
    console.log('✅ Providers seeded:', createdProviders.length);
    return createdProviders;
  } catch (error) {
    console.error('❌ Error seeding providers:', error);
    throw error;
  }
};

// Seed Policies
const seedPolicies = async (providers) => {
  try {
    await Policy.deleteMany({});

    const hdfcErgo = providers.find(p => p.name === 'HDFC ERGO');
    const iciciLombard = providers.find(p => p.name === 'ICICI Lombard');
    const maxLife = providers.find(p => p.name === 'Max Life Insurance');
    const sbiGeneral = providers.find(p => p.name === 'SBI General Insurance');
    const bajajAllianz = providers.find(p => p.name === 'Bajaj Allianz');
    const lic = providers.find(p => p.name === 'LIC (Life Insurance Corporation)');

    const policies = [
      // Health Insurance Policies
      {
        policyName: 'Optima Restore',
        insuranceType: 'health',
        provider: hdfcErgo._id,
        description: 'Unlimited sum insured restoration benefit',
        coverageAmount: {
          min: 300000,
          max: 5000000,
        },
        premium: {
          starting: 6500,
          currency: 'INR',
        },
        features: {
          cashlessHospitalization: true,
          prePostHospitalization: '60/180 days',
          dayCare: true,
          ambulanceCover: true,
          roomRent: 'No capping',
          noClaimBonus: '50% of SI',
        },
        keyBenefits: [
          'Unlimited restore of sum insured',
          'Health check-up every year',
          'No room rent limits',
          'Worldwide coverage',
        ],
        exclusions: [
          'Pre-existing diseases (first 2 years)',
          'Cosmetic surgery',
          'Dental treatment',
        ],
        ageLimit: {
          min: 18,
          max: 65,
        },
        policyTerm: {
          min: 1,
          max: 3,
        },
        claimSettlementRatio: 95.2,
        isActive: true,
      },
      {
        policyName: 'Complete Health Insurance',
        insuranceType: 'health',
        provider: iciciLombard._id,
        description: 'Comprehensive health coverage with extensive benefits',
        coverageAmount: {
          min: 200000,
          max: 3000000,
        },
        premium: {
          starting: 5500,
          currency: 'INR',
        },
        features: {
          cashlessHospitalization: true,
          prePostHospitalization: '60/90 days',
          dayCare: true,
          ambulanceCover: true,
          roomRent: 'Single AC room',
          noClaimBonus: '10% per year',
        },
        keyBenefits: [
          'Automatic recharge of sum insured',
          'Modern treatment coverage',
          'Maternity cover available',
          'Tax benefits under 80D',
        ],
        exclusions: [
          'First year exclusions apply',
          'War and nuclear risks',
          'Self-inflicted injuries',
        ],
        ageLimit: {
          min: 91,
          max: 65,
        },
        policyTerm: {
          min: 1,
          max: 2,
        },
        claimSettlementRatio: 94.8,
        isActive: true,
      },

      // Life Insurance Policies
      {
        policyName: 'Smart Term Plan',
        insuranceType: 'life',
        provider: maxLife._id,
        description: 'Affordable term insurance with high coverage',
        coverageAmount: {
          min: 2500000,
          max: 100000000,
        },
        premium: {
          starting: 7500,
          currency: 'INR',
        },
        features: {
          deathBenefit: true,
          accidentalDeath: '100% additional',
          criticalIllness: 'Optional rider',
          terminalIllness: '50% advance',
          premiumWaiver: 'On disability',
        },
        keyBenefits: [
          'Life cover up to 85 years',
          'Online purchase discount',
          'Flexible payout options',
          'Tax benefits under 80C & 10(10D)',
        ],
        exclusions: [
          'Suicide within 1 year',
          'Death due to intoxication',
          'Pre-existing terminal illness',
        ],
        ageLimit: {
          min: 18,
          max: 65,
        },
        policyTerm: {
          min: 10,
          max: 40,
        },
        claimSettlementRatio: 99.35,
        isActive: true,
      },
      {
        policyName: 'Jeevan Anand',
        insuranceType: 'life',
        provider: lic._id,
        description: 'Traditional whole life plan with savings',
        coverageAmount: {
          min: 100000,
          max: 10000000,
        },
        premium: {
          starting: 20000,
          currency: 'INR',
        },
        features: {
          deathBenefit: true,
          maturityBenefit: true,
          bonusAccumulation: true,
          loanFacility: true,
          surrenderValue: 'After 3 years',
        },
        keyBenefits: [
          'Lifetime coverage',
          'Guaranteed additions',
          'Tax-free maturity',
          'Flexible premium payment',
        ],
        exclusions: [
          'Suicide within 1 year',
          'False information in proposal',
        ],
        ageLimit: {
          min: 18,
          max: 50,
        },
        policyTerm: {
          min: 15,
          max: 35,
        },
        claimSettlementRatio: 98.62,
        isActive: true,
      },

      // Motor Insurance Policies
      {
        policyName: 'Motor Insurance - Own Damage + TP',
        insuranceType: 'motor',
        provider: bajajAllianz._id,
        description: 'Comprehensive car insurance with wide coverage',
        coverageAmount: {
          min: 500000,
          max: 15000000,
        },
        premium: {
          starting: 10000,
          currency: 'INR',
        },
        features: {
          ownDamage: true,
          thirdParty: true,
          personalAccident: '₹15 Lakhs',
          zeroDepreciation: 'Add-on available',
          engineProtection: 'Add-on available',
          roadsideAssistance: true,
        },
        keyBenefits: [
          'Cashless garages across India',
          'No claim bonus up to 50%',
          'Key replacement cover',
          'Return to invoice',
        ],
        exclusions: [
          'Wear and tear',
          'Driving without license',
          'Consequential damages',
        ],
        ageLimit: {
          min: 18,
          max: 75,
        },
        policyTerm: {
          min: 1,
          max: 3,
        },
        claimSettlementRatio: 96.1,
        isActive: true,
      },
      {
        policyName: 'Two Wheeler Package Policy',
        insuranceType: 'motor',
        provider: sbiGeneral._id,
        description: 'Complete protection for bikes and scooters',
        coverageAmount: {
          min: 50000,
          max: 500000,
        },
        premium: {
          starting: 1800,
          currency: 'INR',
        },
        features: {
          ownDamage: true,
          thirdParty: true,
          personalAccident: '₹1 Lakh',
          theftCover: true,
          accessories: 'Up to ₹10,000',
        },
        keyBenefits: [
          'Affordable premiums',
          'Quick claim process',
          'Pan India coverage',
          'No claim bonus',
        ],
        exclusions: [
          'Normal wear and tear',
          'Illegal activities',
          'Drunk driving',
        ],
        ageLimit: {
          min: 18,
          max: 70,
        },
        policyTerm: {
          min: 1,
          max: 3,
        },
        claimSettlementRatio: 93.5,
        isActive: true,
      },

      // Travel Insurance Policies
      {
        policyName: 'Travel Assure',
        insuranceType: 'travel',
        provider: hdfcErgo._id,
        description: 'International travel insurance with comprehensive coverage',
        coverageAmount: {
          min: 500000,
          max: 15000000,
        },
        premium: {
          starting: 2500,
          currency: 'INR',
        },
        features: {
          medicalExpenses: 'As per SI',
          tripCancellation: true,
          baggageLoss: 'Up to $2000',
          passportLoss: 'Up to $500',
          flightDelay: 'Up to $200',
          covid19Cover: true,
        },
        keyBenefits: [
          '24/7 emergency assistance',
          'Adventure sports cover',
          'Family plans available',
          'Instant policy issuance',
        ],
        exclusions: [
          'Pre-existing diseases',
          'High-risk activities',
          'War and terrorism',
        ],
        ageLimit: {
          min: 6,
          max: 70,
        },
        policyTerm: {
          min: 1,
          max: 365,
        },
        claimSettlementRatio: 95.2,
        isActive: true,
      },

      // Home Insurance Policies
      {
        policyName: 'Home Shield Insurance',
        insuranceType: 'home',
        provider: iciciLombard._id,
        description: 'Comprehensive home protection plan',
        coverageAmount: {
          min: 1000000,
          max: 100000000,
        },
        premium: {
          starting: 7000,
          currency: 'INR',
        },
        features: {
          buildingCover: true,
          contentsCover: true,
          fireProtection: true,
          earthquakeCover: true,
          terrorismCover: true,
          theftCover: true,
        },
        keyBenefits: [
          'Rebuilding cost covered',
          'Alternative accommodation',
          'Worldwide contents cover',
          'Personal liability',
        ],
        exclusions: [
          'Normal wear and tear',
          'Gradual deterioration',
          'Nuclear risks',
        ],
        ageLimit: {
          min: 18,
          max: 99,
        },
        policyTerm: {
          min: 1,
          max: 3,
        },
        claimSettlementRatio: 94.8,
        isActive: true,
      },

      // Group Insurance Policies
      {
        policyName: 'Group Mediclaim Policy',
        insuranceType: 'group-health',
        provider: bajajAllianz._id,
        description: 'Corporate health insurance for employees',
        coverageAmount: {
          min: 200000,
          max: 1000000,
        },
        premium: {
          starting: 3500,
          currency: 'INR',
        },
        features: {
          cashlessHospitalization: true,
          prePostHospitalization: '30/60 days',
          maternityBenefit: true,
          dentalCover: true,
          parentCover: 'Optional',
          dayOneCover: true,
        },
        keyBenefits: [
          'No medical tests required',
          'Pre-existing disease cover',
          'Flexible sum insured options',
          'Easy enrollment process',
        ],
        exclusions: [
          'Cosmetic treatments',
          'Experimental procedures',
        ],
        ageLimit: {
          min: 18,
          max: 70,
        },
        policyTerm: {
          min: 1,
          max: 1,
        },
        claimSettlementRatio: 96.1,
        isActive: true,
      },
    ];

    const createdPolicies = await Policy.create(policies);
    console.log('✅ Policies seeded:', createdPolicies.length);
    return createdPolicies;
  } catch (error) {
    console.error('❌ Error seeding policies:', error);
    throw error;
  }
};

// Seed Form Configurations
const seedFormConfigs = async () => {
  try {
    await FormConfig.deleteMany({});

    const formConfigs = [
      {
        insuranceType: 'health',
        steps: [
          {
            stepNumber: 1,
            title: 'Personal Details',
            fields: [
              {
                name: 'fullName',
                label: 'Full Name',
                type: 'text',
                required: true,
                placeholder: 'Enter your full name',
              },
              {
                name: 'dateOfBirth',
                label: 'Date of Birth',
                type: 'date',
                required: true,
              },
              {
                name: 'gender',
                label: 'Gender',
                type: 'select',
                required: true,
                options: ['Male', 'Female', 'Other'],
              },
              {
                name: 'email',
                label: 'Email Address',
                type: 'email',
                required: true,
                placeholder: 'your.email@example.com',
              },
              {
                name: 'phone',
                label: 'Mobile Number',
                type: 'tel',
                required: true,
                placeholder: '+91-XXXXXXXXXX',
              },
            ],
          },
          {
            stepNumber: 2,
            title: 'Coverage Details',
            fields: [
              {
                name: 'coverageAmount',
                label: 'Coverage Amount',
                type: 'select',
                required: true,
                options: ['₹3 Lakhs', '₹5 Lakhs', '₹10 Lakhs', '₹25 Lakhs', '₹50 Lakhs'],
              },
              {
                name: 'familyMembers',
                label: 'Number of Family Members',
                type: 'number',
                required: true,
                min: 1,
                max: 10,
              },
              {
                name: 'preExistingConditions',
                label: 'Do you have any pre-existing medical conditions?',
                type: 'radio',
                required: true,
                options: ['Yes', 'No'],
              },
            ],
          },
          {
            stepNumber: 3,
            title: 'Additional Information',
            fields: [
              {
                name: 'occupation',
                label: 'Occupation',
                type: 'text',
                required: true,
              },
              {
                name: 'annualIncome',
                label: 'Annual Income',
                type: 'select',
                required: true,
                options: ['Below ₹5 Lakhs', '₹5-10 Lakhs', '₹10-25 Lakhs', 'Above ₹25 Lakhs'],
              },
              {
                name: 'preferredStartDate',
                label: 'Preferred Start Date',
                type: 'date',
                required: false,
              },
            ],
          },
        ],
        isActive: true,
      },
      {
        insuranceType: 'life',
        steps: [
          {
            stepNumber: 1,
            title: 'Personal Information',
            fields: [
              {
                name: 'fullName',
                label: 'Full Name',
                type: 'text',
                required: true,
              },
              {
                name: 'dateOfBirth',
                label: 'Date of Birth',
                type: 'date',
                required: true,
              },
              {
                name: 'gender',
                label: 'Gender',
                type: 'select',
                required: true,
                options: ['Male', 'Female'],
              },
              {
                name: 'email',
                label: 'Email',
                type: 'email',
                required: true,
              },
              {
                name: 'phone',
                label: 'Phone Number',
                type: 'tel',
                required: true,
              },
            ],
          },
          {
            stepNumber: 2,
            title: 'Policy Details',
            fields: [
              {
                name: 'coverageAmount',
                label: 'Life Cover Amount',
                type: 'select',
                required: true,
                options: ['₹25 Lakhs', '₹50 Lakhs', '₹1 Crore', '₹2 Crore'],
              },
              {
                name: 'policyTerm',
                label: 'Policy Term (Years)',
                type: 'select',
                required: true,
                options: ['10', '15', '20', '25', '30'],
              },
              {
                name: 'smoker',
                label: 'Do you smoke?',
                type: 'radio',
                required: true,
                options: ['Yes', 'No'],
              },
            ],
          },
          {
            stepNumber: 3,
            title: 'Nominee Details',
            fields: [
              {
                name: 'nomineeName',
                label: 'Nominee Name',
                type: 'text',
                required: true,
              },
              {
                name: 'nomineeRelation',
                label: 'Relation with Nominee',
                type: 'select',
                required: true,
                options: ['Spouse', 'Parent', 'Child', 'Sibling', 'Other'],
              },
              {
                name: 'nomineeAge',
                label: 'Nominee Age',
                type: 'number',
                required: true,
              },
            ],
          },
        ],
        isActive: true,
      },
      {
        insuranceType: 'motor',
        steps: [
          {
            stepNumber: 1,
            title: 'Vehicle Details',
            fields: [
              {
                name: 'vehicleType',
                label: 'Vehicle Type',
                type: 'select',
                required: true,
                options: ['Car', 'Two Wheeler'],
              },
              {
                name: 'registrationNumber',
                label: 'Registration Number',
                type: 'text',
                required: true,
                placeholder: 'DL-01-AB-1234',
              },
              {
                name: 'make',
                label: 'Vehicle Make',
                type: 'text',
                required: true,
                placeholder: 'e.g., Maruti, Honda',
              },
              {
                name: 'model',
                label: 'Vehicle Model',
                type: 'text',
                required: true,
              },
              {
                name: 'year',
                label: 'Year of Purchase',
                type: 'number',
                required: true,
                min: 2000,
                max: 2024,
              },
            ],
          },
          {
            stepNumber: 2,
            title: 'Owner Details',
            fields: [
              {
                name: 'fullName',
                label: 'Full Name',
                type: 'text',
                required: true,
              },
              {
                name: 'email',
                label: 'Email',
                type: 'email',
                required: true,
              },
              {
                name: 'phone',
                label: 'Phone Number',
                type: 'tel',
                required: true,
              },
              {
                name: 'previousInsurer',
                label: 'Previous Insurance Company',
                type: 'text',
                required: false,
              },
            ],
          },
        ],
        isActive: true,
      },
    ];

    const createdConfigs = await FormConfig.create(formConfigs);
    console.log('✅ Form configs seeded:', createdConfigs.length);
    return createdConfigs;
  } catch (error) {
    console.error('❌ Error seeding form configs:', error);
    throw error;
  }
};

// Seed Jobs
const seedJobs = async () => {
  try {
    await Job.deleteMany({});

    const jobs = [
      {
        title: 'Senior Insurance Sales Manager',
        department: 'Sales',
        location: 'Mumbai, Maharashtra',
        type: 'Full-time',
        experience: '5-8 years',
        description: 'We are looking for an experienced Insurance Sales Manager to lead our sales team and drive business growth.',
        responsibilities: [
          'Lead and manage the sales team',
          'Develop and implement sales strategies',
          'Build relationships with corporate clients',
          'Achieve monthly and quarterly sales targets',
          'Train and mentor junior sales staff',
        ],
        requirements: [
          'Minimum 5 years in insurance sales',
          'Proven track record in B2B sales',
          'Strong leadership skills',
          'Excellent communication skills',
          'MBA preferred',
        ],
        skills: ['Sales Management', 'Team Leadership', 'Client Relations', 'Negotiation'],
        salary: {
          min: 800000,
          max: 1200000,
          currency: 'INR',
        },
        status: 'open',
        openings: 2,
        isActive: true,
      },
      {
        title: 'Insurance Claims Specialist',
        department: 'Claims',
        location: 'Bangalore, Karnataka',
        type: 'Full-time',
        experience: '2-4 years',
        description: 'Join our claims team to ensure smooth and efficient claim processing for our customers.',
        responsibilities: [
          'Process insurance claims efficiently',
          'Verify claim documents and information',
          'Coordinate with hospitals and service providers',
          'Maintain claim records and documentation',
          'Provide customer support during claim process',
        ],
        requirements: [
          '2+ years in insurance claims',
          'Knowledge of health insurance processes',
          'Strong analytical skills',
          'Good communication skills',
          'Insurance certification preferred',
        ],
        skills: ['Claims Processing', 'Documentation', 'Customer Service', 'Analysis'],
        salary: {
          min: 400000,
          max: 600000,
          currency: 'INR',
        },
        status: 'open',
        openings: 3,
        isActive: true,
      },
      {
        title: 'Digital Marketing Executive',
        department: 'Marketing',
        location: 'Gurugram, Haryana',
        type: 'Full-time',
        experience: '1-3 years',
        description: 'We need a creative Digital Marketing Executive to enhance our online presence and customer engagement.',
        responsibilities: [
          'Manage social media platforms',
          'Create engaging content for digital channels',
          'Run and optimize digital ad campaigns',
          'Analyze campaign performance metrics',
          'Collaborate with design and sales teams',
        ],
        requirements: [
          '1-3 years in digital marketing',
          'Experience with social media marketing',
          'Knowledge of SEO and SEM',
          'Content creation skills',
          'Analytics tools proficiency',
        ],
        skills: ['Social Media Marketing', 'Content Creation', 'SEO', 'Google Analytics', 'PPC'],
        salary: {
          min: 350000,
          max: 550000,
          currency: 'INR',
        },
        status: 'open',
        openings: 1,
        isActive: true,
      },
      {
        title: 'Customer Service Representative',
        department: 'Customer Support',
        location: 'Pune, Maharashtra',
        type: 'Full-time',
        experience: '0-2 years',
        description: 'Freshers welcome! Join our customer support team to assist customers with their insurance needs.',
        responsibilities: [
          'Handle customer inquiries via phone, email, and chat',
          'Provide information about insurance products',
          'Assist with policy renewals and updates',
          'Resolve customer complaints',
          'Maintain customer records',
        ],
        requirements: [
          'Excellent communication skills',
          'Customer-centric approach',
          'Basic computer knowledge',
          'Willingness to learn',
          'Graduate in any stream',
        ],
        skills: ['Communication', 'Customer Service', 'Problem Solving', 'MS Office'],
        salary: {
          min: 250000,
          max: 350000,
          currency: 'INR',
        },
        status: 'open',
        openings: 5,
        isActive: true,
      },
      {
        title: 'Underwriting Manager',
        department: 'Underwriting',
        location: 'Chennai, Tamil Nadu',
        type: 'Full-time',
        experience: '4-7 years',
        description: 'Lead our underwriting team and ensure quality risk assessment for all insurance applications.',
        responsibilities: [
          'Review and approve insurance applications',
          'Assess risk factors and determine premiums',
          'Develop underwriting guidelines',
          'Train and supervise underwriters',
          'Collaborate with actuarial team',
        ],
        requirements: [
          'Minimum 4 years in underwriting',
          'Strong analytical and decision-making skills',
          'Knowledge of insurance regulations',
          'Leadership experience',
          'Professional certification preferred',
        ],
        skills: ['Risk Assessment', 'Underwriting', 'Team Management', 'Analytical Skills'],
        salary: {
          min: 700000,
          max: 1000000,
          currency: 'INR',
        },
        status: 'open',
        openings: 1,
        isActive: true,
      },
      {
        title: 'Full Stack Developer',
        department: 'Technology',
        location: 'Hyderabad, Telangana',
        type: 'Full-time',
        experience: '3-5 years',
        description: 'Join our tech team to build and maintain our insurance platform.',
        responsibilities: [
          'Develop and maintain web applications',
          'Build RESTful APIs',
          'Implement responsive UI/UX designs',
          'Write clean, maintainable code',
          'Collaborate with product team',
        ],
        requirements: [
          '3+ years in full stack development',
          'Proficiency in React.js and Node.js',
          'Experience with MongoDB',
          'Knowledge of Azure/AWS',
          'Strong problem-solving skills',
        ],
        skills: ['React.js', 'Node.js', 'MongoDB', 'REST APIs', 'Azure', 'Git'],
        salary: {
          min: 900000,
          max: 1500000,
          currency: 'INR',
        },
        status: 'open',
        openings: 2,
        isActive: true,
      },
    ];

    const createdJobs = await Job.create(jobs);
    console.log('✅ Jobs seeded:', createdJobs.length);
    return createdJobs;
  } catch (error) {
    console.error('❌ Error seeding jobs:', error);
    throw error;
  }
};

// Seed Company Info
const seedCompanyInfo = async () => {
  try {
    await CompanyInfo.deleteMany({});

    const companyInfo = [
      {
        section: 'about',
        title: 'About Arham Secure Insurance',
        content: 'Arham Secure Insurance is a leading corporate insurance platform providing comprehensive insurance solutions to individuals and businesses across India. With over a decade of experience, we have built trust with thousands of customers by offering transparent, reliable, and customer-centric insurance products.',
        metadata: {
          foundedYear: 2012,
          customersServed: '500,000+',
          claimSettlement: '98.5%',
          networkHospitals: '10,000+',
        },
        isActive: true,
      },
      {
        section: 'mission',
        title: 'Our Mission',
        content: 'To make insurance simple, accessible, and affordable for everyone. We believe in empowering our customers with the right insurance coverage that protects what matters most to them.',
        isActive: true,
      },
      {
        section: 'vision',
        title: 'Our Vision',
        content: 'To become India\'s most trusted and innovative insurance platform, setting new standards in customer service and digital insurance solutions.',
        isActive: true,
      },
      {
        section: 'values',
        title: 'Our Core Values',
        content: JSON.stringify([
          {
            title: 'Trust',
            description: 'Building lasting relationships through transparency and integrity',
            icon: 'handshake',
          },
          {
            title: 'Customer First',
            description: 'Putting customer needs at the center of everything we do',
            icon: 'users',
          },
          {
            title: 'Innovation',
            description: 'Constantly evolving to provide better insurance solutions',
            icon: 'lightbulb',
          },
          {
            title: 'Excellence',
            description: 'Delivering superior service and maintaining high standards',
            icon: 'award',
          },
        ]),
        isActive: true,
      },
      {
        section: 'team',
        title: 'Leadership Team',
        content: JSON.stringify([
          {
            name: 'Rajesh Kumar',
            designation: 'CEO & Founder',
            bio: '20+ years in insurance industry',
            image: 'https://example.com/team/rajesh.jpg',
            linkedin: 'https://linkedin.com/in/rajeshkumar',
          },
          {
            name: 'Priya Sharma',
            designation: 'Chief Operating Officer',
            bio: 'Expert in operations and customer service',
            image: 'https://example.com/team/priya.jpg',
            linkedin: 'https://linkedin.com/in/priyasharma',
          },
          {
            name: 'Amit Patel',
            designation: 'Chief Technology Officer',
            bio: 'Leading digital transformation initiatives',
            image: 'https://example.com/team/amit.jpg',
            linkedin: 'https://linkedin.com/in/amitpatel',
          },
        ]),
        isActive: true,
      },
      {
        section: 'partners',
        title: 'Our Insurance Partners',
        content: 'We partner with India\'s leading insurance companies to offer you the best coverage options at competitive prices.',
        metadata: {
          totalPartners: 15,
          lifeInsurers: 6,
          generalInsurers: 9,
        },
        isActive: true,
      },
      {
        section: 'clients',
        title: 'Corporate Clients',
        content: JSON.stringify([
          { name: 'Tech Corp India', logo: 'https://example.com/clients/techcorp.png' },
          { name: 'Global Solutions Ltd', logo: 'https://example.com/clients/global.png' },
          { name: 'Finance Pro', logo: 'https://example.com/clients/finance.png' },
          { name: 'Healthcare Plus', logo: 'https://example.com/clients/healthcare.png' },
        ]),
        isActive: true,
      },
    ];

    const createdInfo = await CompanyInfo.create(companyInfo);
    console.log('✅ Company info seeded:', createdInfo.length);
    return createdInfo;
  } catch (error) {
    console.error('❌ Error seeding company info:', error);
    throw error;
  }
};

// Seed Locations
const seedLocations = async () => {
  try {
    await Location.deleteMany({});

    const locations = [
      {
        city: 'Mumbai',
        address: '12th Floor, Nariman Point, Mumbai, Maharashtra 400021',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400021',
        phone: '+91-22-6789-1234',
        email: 'mumbai@arhamsecure.com',
        coordinates: {
          latitude: 18.9220,
          longitude: 72.8347,
        },
        officeHours: {
          weekdays: '9:00 AM - 6:00 PM',
          saturday: '10:00 AM - 2:00 PM',
          sunday: 'Closed',
        },
        isHeadOffice: true,
        isActive: true,
      },
      {
        city: 'Bangalore',
        address: 'Tower B, MG Road, Bangalore, Karnataka 560001',
        state: 'Karnataka',
        country: 'India',
        pincode: '560001',
        phone: '+91-80-4567-8901',
        email: 'bangalore@arhamsecure.com',
        coordinates: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
        officeHours: {
          weekdays: '9:00 AM - 6:00 PM',
          saturday: '10:00 AM - 2:00 PM',
          sunday: 'Closed',
        },
        isHeadOffice: false,
        isActive: true,
      },
      {
        city: 'Delhi',
        address: 'Plot 15, Connaught Place, New Delhi, Delhi 110001',
        state: 'Delhi',
        country: 'India',
        pincode: '110001',
        phone: '+91-11-2345-6789',
        email: 'delhi@arhamsecure.com',
        coordinates: {
          latitude: 28.6139,
          longitude: 77.2090,
        },
        officeHours: {
          weekdays: '9:00 AM - 6:00 PM',
          saturday: '10:00 AM - 2:00 PM',
          sunday: 'Closed',
        },
        isHeadOffice: false,
        isActive: true,
      },
      {
        city: 'Gurugram',
        address: 'Cyber City, DLF Phase 2, Gurugram, Haryana 122002',
        state: 'Haryana',
        country: 'India',
        pincode: '122002',
        phone: '+91-124-456-7890',
        email: 'gurugram@arhamsecure.com',
        coordinates: {
          latitude: 28.4595,
          longitude: 77.0266,
        },
        officeHours: {
          weekdays: '9:00 AM - 6:00 PM',
          saturday: '10:00 AM - 2:00 PM',
          sunday: 'Closed',
        },
        isHeadOffice: false,
        isActive: true,
      },
      {
        city: 'Chennai',
        address: 'Anna Salai, T Nagar, Chennai, Tamil Nadu 600017',
        state: 'Tamil Nadu',
        country: 'India',
        pincode: '600017',
        phone: '+91-44-3456-7890',
        email: 'chennai@arhamsecure.com',
        coordinates: {
          latitude: 13.0827,
          longitude: 80.2707,
        },
        officeHours: {
          weekdays: '9:00 AM - 6:00 PM',
          saturday: '10:00 AM - 2:00 PM',
          sunday: 'Closed',
        },
        isHeadOffice: false,
        isActive: true,
      },
    ];

    const createdLocations = await Location.create(locations);
    console.log('✅ Locations seeded:', createdLocations.length);
    return createdLocations;
  } catch (error) {
    console.error('❌ Error seeding locations:', error);
    throw error;
  }
};

// Main seed function
const seedDatabase = async () => {
  try {
    console.log('\n🌱 Starting database seeding...\n');

    await connectDB();

    const users = await seedUsers();
    const categories = await seedCategories();
    const products = await seedProducts(categories);
    const providers = await seedProviders();
    const policies = await seedPolicies(providers);
    const formConfigs = await seedFormConfigs();
    const jobs = await seedJobs();
    const companyInfo = await seedCompanyInfo();
    const locations = await seedLocations();

    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Categories: ${categories.length}`);
    console.log(`   - Products: ${products.length}`);
    console.log(`   - Providers: ${providers.length}`);
    console.log(`   - Policies: ${policies.length}`);
    console.log(`   - Form Configs: ${formConfigs.length}`);
    console.log(`   - Jobs: ${jobs.length}`);
    console.log(`   - Company Info: ${companyInfo.length}`);
    console.log(`   - Locations: ${locations.length}\n`);

    console.log('📝 Test Credentials:');
    console.log('   Admin: admin@arhamsecure.com / Admin@123');
    console.log('   Agent: agent@arhamsecure.com / Agent@123');
    console.log('   User: rahul@example.com / User@123\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();