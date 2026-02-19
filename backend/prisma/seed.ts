import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Seed Data ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@tsrtc.hydgo.com';
const ADMIN_PASSWORD = 'Admin@2026';
const ADMIN_NAME = 'TSRTC Admin';
const ADMIN_PHONE = '+919900000001';

interface RouteSeed {
  routeNumber: string;
  name: string;
  routeType: 'LOCAL' | 'METRO_EXPRESS' | 'SUPER_LUXURY' | 'PALLE_VELUGU' | 'EXPRESS' | 'GARUDA_PLUS';
  distance: number;
  avgSpeed: number;
  stops: { name: string; lat: number; lng: number }[];
}

const routes: RouteSeed[] = [
  // ── Core city routes ───────────────────────────────────────────────────
  {
    routeNumber: '10K',
    name: 'MGBS → Miyapur',
    routeType: 'METRO_EXPRESS',
    distance: 28,
    avgSpeed: 30,
    stops: [
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'Abids', lat: 17.3899, lng: 78.4743 },
      { name: 'Lakdi-ka-pul', lat: 17.4005, lng: 78.4667 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'SR Nagar', lat: 17.4402, lng: 78.4399 },
      { name: 'ESI Hospital', lat: 17.4485, lng: 78.4321 },
      { name: 'Erragadda', lat: 17.4534, lng: 78.4267 },
      { name: 'Bharat Nagar', lat: 17.4602, lng: 78.4175 },
      { name: 'Kukatpally', lat: 17.4849, lng: 78.3942 },
      { name: 'KPHB Colony', lat: 17.4946, lng: 78.3901 },
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
    ],
  },
  {
    routeNumber: '216',
    name: 'Secunderabad → Mehdipatnam',
    routeType: 'LOCAL',
    distance: 18,
    avgSpeed: 22,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Paradise', lat: 17.4422, lng: 78.4833 },
      { name: 'Begumpet', lat: 17.4430, lng: 78.4686 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'Panjagutta', lat: 17.4280, lng: 78.4497 },
      { name: 'Banjara Hills', lat: 17.4156, lng: 78.4484 },
      { name: 'Masab Tank', lat: 17.3993, lng: 78.4546 },
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
    ],
  },
  {
    routeNumber: '5K',
    name: 'JBS → ECIL X Roads',
    routeType: 'EXPRESS',
    distance: 22,
    avgSpeed: 28,
    stops: [
      { name: 'JBS (Jubilee Bus Station)', lat: 17.4531, lng: 78.4985 },
      { name: 'Malkajgiri', lat: 17.4573, lng: 78.5099 },
      { name: 'Neredmet', lat: 17.4708, lng: 78.5254 },
      { name: 'Sainikpuri', lat: 17.4844, lng: 78.5409 },
      { name: 'AS Rao Nagar', lat: 17.4892, lng: 78.5513 },
      { name: 'ECIL X Roads', lat: 17.4737, lng: 78.5716 },
    ],
  },
  {
    routeNumber: '49M',
    name: 'Ameerpet → Uppal',
    routeType: 'LOCAL',
    distance: 16,
    avgSpeed: 20,
    stops: [
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'Vidyanagar', lat: 17.4311, lng: 78.4572 },
      { name: 'Narayanguda', lat: 17.3963, lng: 78.4824 },
      { name: 'Chaderghat', lat: 17.3804, lng: 78.4921 },
      { name: 'Malakpet', lat: 17.3749, lng: 78.4998 },
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
      { name: 'Nagole', lat: 17.3822, lng: 78.5505 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
    ],
  },
  {
    routeNumber: '290',
    name: 'LB Nagar → Afzalgunj',
    routeType: 'LOCAL',
    distance: 12,
    avgSpeed: 18,
    stops: [
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Kothapet', lat: 17.3592, lng: 78.5353 },
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
      { name: 'Malakpet', lat: 17.3749, lng: 78.4998 },
      { name: 'Chaderghat', lat: 17.3804, lng: 78.4921 },
      { name: 'Afzalgunj', lat: 17.3756, lng: 78.4768 },
    ],
  },

  // ── Phase 8.7: Expanded TSRTC network ──────────────────────────────────

  // Narapally / Ghatkesar corridor → Secunderabad
  {
    routeNumber: '188',
    name: 'Narapally → Secunderabad',
    routeType: 'LOCAL',
    distance: 32,
    avgSpeed: 25,
    stops: [
      { name: 'Narapally', lat: 17.4122, lng: 78.6361 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'Peerzadiguda', lat: 17.4100, lng: 78.5920 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Habsiguda', lat: 17.4090, lng: 78.5340 },
      { name: 'Tarnaka', lat: 17.4270, lng: 78.5210 },
      { name: 'Mettuguda', lat: 17.4340, lng: 78.5110 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },
  {
    routeNumber: '188G',
    name: 'Ghatkesar → Secunderabad',
    routeType: 'LOCAL',
    distance: 36,
    avgSpeed: 24,
    stops: [
      { name: 'Ghatkesar', lat: 17.4500, lng: 78.6830 },
      { name: 'Narapally', lat: 17.4122, lng: 78.6361 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'Peerzadiguda', lat: 17.4100, lng: 78.5920 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Nacharam', lat: 17.4130, lng: 78.5470 },
      { name: 'Habsiguda', lat: 17.4090, lng: 78.5340 },
      { name: 'Tarnaka', lat: 17.4270, lng: 78.5210 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },
  // Ghatkesar → Uppal (short local)
  {
    routeNumber: '188U',
    name: 'Ghatkesar → Uppal',
    routeType: 'LOCAL',
    distance: 18,
    avgSpeed: 22,
    stops: [
      { name: 'Ghatkesar', lat: 17.4500, lng: 78.6830 },
      { name: 'Narapally', lat: 17.4122, lng: 78.6361 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'Peerzadiguda', lat: 17.4100, lng: 78.5920 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
    ],
  },

  // Uppal → MGBS (connects eastern corridor to central)
  {
    routeNumber: '119',
    name: 'Uppal → MGBS',
    routeType: 'LOCAL',
    distance: 20,
    avgSpeed: 20,
    stops: [
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Nagole', lat: 17.3822, lng: 78.5505 },
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Kothapet', lat: 17.3592, lng: 78.5353 },
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
      { name: 'Malakpet', lat: 17.3749, lng: 78.4998 },
      { name: 'Chaderghat', lat: 17.3804, lng: 78.4921 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
    ],
  },

  // ECIL → Secunderabad (connects northeast to central)
  {
    routeNumber: '102',
    name: 'ECIL → Secunderabad',
    routeType: 'LOCAL',
    distance: 16,
    avgSpeed: 22,
    stops: [
      { name: 'ECIL X Roads', lat: 17.4737, lng: 78.5716 },
      { name: 'AS Rao Nagar', lat: 17.4892, lng: 78.5513 },
      { name: 'Neredmet', lat: 17.4708, lng: 78.5254 },
      { name: 'Malkajgiri', lat: 17.4573, lng: 78.5099 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },

  // LB Nagar → Secunderabad (south-east to central)
  {
    routeNumber: '107',
    name: 'LB Nagar → Secunderabad',
    routeType: 'LOCAL',
    distance: 22,
    avgSpeed: 21,
    stops: [
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Kothapet', lat: 17.3592, lng: 78.5353 },
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
      { name: 'Malakpet', lat: 17.3749, lng: 78.4998 },
      { name: 'Chaderghat', lat: 17.3804, lng: 78.4921 },
      { name: 'Koti', lat: 17.3860, lng: 78.4880 },
      { name: 'Sultan Bazaar', lat: 17.3900, lng: 78.4880 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },

  // Miyapur → Secunderabad (west to central via major stops)
  {
    routeNumber: '127',
    name: 'Miyapur → Secunderabad',
    routeType: 'EXPRESS',
    distance: 30,
    avgSpeed: 28,
    stops: [
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
      { name: 'KPHB Colony', lat: 17.4946, lng: 78.3901 },
      { name: 'Kukatpally', lat: 17.4849, lng: 78.3942 },
      { name: 'Balanagar', lat: 17.4701, lng: 78.4367 },
      { name: 'Bowenpally', lat: 17.4620, lng: 78.4760 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },

  // Mehdipatnam → MGBS (southwest to central)
  {
    routeNumber: '65',
    name: 'Mehdipatnam → MGBS',
    routeType: 'LOCAL',
    distance: 10,
    avgSpeed: 18,
    stops: [
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
      { name: 'Masab Tank', lat: 17.3993, lng: 78.4546 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'Abids', lat: 17.3899, lng: 78.4743 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
    ],
  },

  // Jubilee Hills → MGBS (posh area to central)
  {
    routeNumber: '127C',
    name: 'Jubilee Hills → MGBS',
    routeType: 'LOCAL',
    distance: 14,
    avgSpeed: 20,
    stops: [
      { name: 'Jubilee Hills Check Post', lat: 17.4270, lng: 78.4120 },
      { name: 'Jubilee Hills Road No 36', lat: 17.4250, lng: 78.4250 },
      { name: 'Panjagutta', lat: 17.4280, lng: 78.4497 },
      { name: 'Lakdi-ka-pul', lat: 17.4005, lng: 78.4667 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
    ],
  },

  // Shamshabad Airport → MGBS (airport express)
  {
    routeNumber: '142',
    name: 'Airport → MGBS',
    routeType: 'EXPRESS',
    distance: 32,
    avgSpeed: 35,
    stops: [
      { name: 'Shamshabad Airport', lat: 17.2403, lng: 78.4294 },
      { name: 'Shamshabad', lat: 17.2543, lng: 78.4287 },
      { name: 'Aramghar', lat: 17.3224, lng: 78.4431 },
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
      { name: 'Lakdi-ka-pul', lat: 17.4005, lng: 78.4667 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
    ],
  },

  // Kompally → Secunderabad (north suburb to central)
  {
    routeNumber: '212',
    name: 'Kompally → Secunderabad',
    routeType: 'LOCAL',
    distance: 18,
    avgSpeed: 22,
    stops: [
      { name: 'Kompally', lat: 17.5337, lng: 78.4865 },
      { name: 'Suchitra', lat: 17.4937, lng: 78.4885 },
      { name: 'Bowenpally', lat: 17.4620, lng: 78.4760 },
      { name: 'Trimulgherry', lat: 17.4555, lng: 78.4860 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },

  // Narapally → Dilsukhnagar (cross-city east to south)
  {
    routeNumber: '300',
    name: 'Narapally → Dilsukhnagar',
    routeType: 'LOCAL',
    distance: 24,
    avgSpeed: 20,
    stops: [
      { name: 'Narapally', lat: 17.4122, lng: 78.6361 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'Peerzadiguda', lat: 17.4100, lng: 78.5920 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Nagole', lat: 17.3822, lng: 78.5505 },
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
    ],
  },

  // Hitech City / Gachibowli (western IT corridor)
  {
    routeNumber: '10H',
    name: 'MGBS → Hitech City',
    routeType: 'METRO_EXPRESS',
    distance: 26,
    avgSpeed: 28,
    stops: [
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'Lakdi-ka-pul', lat: 17.4005, lng: 78.4667 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'SR Nagar', lat: 17.4402, lng: 78.4399 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
      { name: 'Hitech City', lat: 17.4474, lng: 78.3762 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
    ],
  },

  // Secunderabad → Medchal (northern corridor)
  {
    routeNumber: '250',
    name: 'Secunderabad → Medchal',
    routeType: 'LOCAL',
    distance: 26,
    avgSpeed: 24,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Trimulgherry', lat: 17.4555, lng: 78.4860 },
      { name: 'Bowenpally', lat: 17.4620, lng: 78.4760 },
      { name: 'Suchitra', lat: 17.4937, lng: 78.4885 },
      { name: 'Kompally', lat: 17.5337, lng: 78.4865 },
      { name: 'Medchal', lat: 17.6319, lng: 78.4816 },
    ],
  },

  // ── Phase 9: Expanded Network ─────────────────────────────────────────────

  // Old City / Charminar corridor
  {
    routeNumber: '221',
    name: 'Secunderabad → Charminar',
    routeType: 'LOCAL',
    distance: 16,
    avgSpeed: 18,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Paradise', lat: 17.4422, lng: 78.4833 },
      { name: 'Begumpet', lat: 17.4430, lng: 78.4686 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'Panjagutta', lat: 17.4280, lng: 78.4497 },
      { name: 'Narayanguda', lat: 17.3963, lng: 78.4824 },
      { name: 'Koti', lat: 17.3860, lng: 78.4880 },
      { name: 'Sultan Bazaar', lat: 17.3900, lng: 78.4880 },
      { name: 'Abids', lat: 17.3899, lng: 78.4743 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'Afzalgunj', lat: 17.3756, lng: 78.4768 },
      { name: 'Shalibanda', lat: 17.3650, lng: 78.4830 },
      { name: 'Charminar', lat: 17.3616, lng: 78.4747 },
    ],
  },
  {
    routeNumber: '221C',
    name: 'Charminar → Nampally',
    routeType: 'LOCAL',
    distance: 8,
    avgSpeed: 16,
    stops: [
      { name: 'Charminar', lat: 17.3616, lng: 78.4747 },
      { name: 'Shalibanda', lat: 17.3650, lng: 78.4830 },
      { name: 'Yakutpura', lat: 17.3570, lng: 78.4930 },
      { name: 'Darulshifa', lat: 17.3720, lng: 78.4810 },
      { name: 'Afzalgunj', lat: 17.3756, lng: 78.4768 },
      { name: 'Musaddilal Chowk', lat: 17.3800, lng: 78.4730 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
    ],
  },
  // IT Western corridor
  {
    routeNumber: '85',
    name: 'Ameerpet → Kokapet',
    routeType: 'EXPRESS',
    distance: 22,
    avgSpeed: 30,
    stops: [
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'Panjagutta', lat: 17.4280, lng: 78.4497 },
      { name: 'Banjara Hills Road No 12', lat: 17.4237, lng: 78.4423 },
      { name: 'Jubilee Hills Check Post', lat: 17.4270, lng: 78.4120 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
      { name: 'Hitech City', lat: 17.4474, lng: 78.3762 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Nanakramguda', lat: 17.4325, lng: 78.3406 },
      { name: 'Financial District', lat: 17.4183, lng: 78.3363 },
      { name: 'Kokapet', lat: 17.4060, lng: 78.3270 },
    ],
  },
  {
    routeNumber: '3K',
    name: 'Kukatpally → Kokapet IT Shuttle',
    routeType: 'METRO_EXPRESS',
    distance: 18,
    avgSpeed: 32,
    stops: [
      { name: 'Kukatpally', lat: 17.4849, lng: 78.3942 },
      { name: 'KPHB Colony', lat: 17.4946, lng: 78.3901 },
      { name: 'Bachupally', lat: 17.5170, lng: 78.3760 },
      { name: 'Kondapur', lat: 17.4600, lng: 78.3738 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
      { name: 'Hitech City', lat: 17.4474, lng: 78.3762 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Nanakramguda', lat: 17.4325, lng: 78.3406 },
      { name: 'Financial District', lat: 17.4183, lng: 78.3363 },
      { name: 'Kokapet', lat: 17.4060, lng: 78.3270 },
      { name: 'Narsingi', lat: 17.3944, lng: 78.3240 },
    ],
  },
  {
    routeNumber: '33C',
    name: 'Mehdipatnam → Shamshabad',
    routeType: 'LOCAL',
    distance: 28,
    avgSpeed: 24,
    stops: [
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
      { name: 'Tolichowki', lat: 17.3879, lng: 78.4154 },
      { name: 'Manikonda', lat: 17.4038, lng: 78.3770 },
      { name: 'Puppalguda', lat: 17.3880, lng: 78.3750 },
      { name: 'Narsingi', lat: 17.3944, lng: 78.3240 },
      { name: 'Gandipet', lat: 17.3920, lng: 78.3050 },
      { name: 'Manchirevula', lat: 17.3600, lng: 78.3350 },
      { name: 'Rajendra Nagar', lat: 17.3427, lng: 78.4156 },
      { name: 'Aramghar', lat: 17.3224, lng: 78.4431 },
      { name: 'Shamshabad', lat: 17.2543, lng: 78.4287 },
    ],
  },
  {
    routeNumber: '47E',
    name: 'JBS → Patancheru',
    routeType: 'EXPRESS',
    distance: 35,
    avgSpeed: 32,
    stops: [
      { name: 'JBS (Jubilee Bus Station)', lat: 17.4531, lng: 78.4985 },
      { name: 'Paradise', lat: 17.4422, lng: 78.4833 },
      { name: 'Begumpet', lat: 17.4430, lng: 78.4686 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'SR Nagar', lat: 17.4402, lng: 78.4399 },
      { name: 'ESI Hospital', lat: 17.4485, lng: 78.4321 },
      { name: 'Kukatpally', lat: 17.4849, lng: 78.3942 },
      { name: 'Balanagar', lat: 17.4701, lng: 78.4367 },
      { name: 'Isnapur', lat: 17.5020, lng: 78.3560 },
      { name: 'Patancheru', lat: 17.5283, lng: 78.2688 },
    ],
  },
  {
    routeNumber: '7C',
    name: 'Miyapur → Sangareddy',
    routeType: 'GARUDA_PLUS',
    distance: 45,
    avgSpeed: 50,
    stops: [
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
      { name: 'Bachupally', lat: 17.5170, lng: 78.3760 },
      { name: 'Nizampet', lat: 17.5208, lng: 78.3848 },
      { name: 'Isnapur', lat: 17.5020, lng: 78.3560 },
      { name: 'Patancheru', lat: 17.5283, lng: 78.2688 },
      { name: 'Sadasivpet', lat: 17.6208, lng: 77.9550 },
      { name: 'Sangareddy', lat: 17.6242, lng: 78.0869 },
    ],
  },
  {
    routeNumber: '58',
    name: 'Secunderabad → Dundigal',
    routeType: 'LOCAL',
    distance: 32,
    avgSpeed: 26,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Bowenpally', lat: 17.4620, lng: 78.4760 },
      { name: 'Alwal', lat: 17.4990, lng: 78.5010 },
      { name: 'Jeedimetla', lat: 17.5198, lng: 78.4790 },
      { name: 'Bahadurpally', lat: 17.5628, lng: 78.4524 },
      { name: 'Ramachandrapuram', lat: 17.5760, lng: 78.3930 },
      { name: 'Dundigal', lat: 17.6063, lng: 78.3726 },
    ],
  },
  {
    routeNumber: '98',
    name: 'JBS → Ramachandrapuram',
    routeType: 'LOCAL',
    distance: 24,
    avgSpeed: 24,
    stops: [
      { name: 'JBS (Jubilee Bus Station)', lat: 17.4531, lng: 78.4985 },
      { name: 'Karkhana', lat: 17.4600, lng: 78.4900 },
      { name: 'Trimulgherry', lat: 17.4555, lng: 78.4860 },
      { name: 'Bowenpally', lat: 17.4620, lng: 78.4760 },
      { name: 'Alwal', lat: 17.4990, lng: 78.5010 },
      { name: 'Jeedimetla', lat: 17.5198, lng: 78.4790 },
      { name: 'Bahadurpally', lat: 17.5628, lng: 78.4524 },
      { name: 'Ramachandrapuram', lat: 17.5760, lng: 78.3930 },
    ],
  },
  {
    routeNumber: '218',
    name: 'Secunderabad → Cherlapally',
    routeType: 'LOCAL',
    distance: 18,
    avgSpeed: 22,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Malkajgiri', lat: 17.4573, lng: 78.5099 },
      { name: 'Neredmet', lat: 17.4708, lng: 78.5254 },
      { name: 'Kapra', lat: 17.4830, lng: 78.5456 },
      { name: 'Yapral', lat: 17.4940, lng: 78.5540 },
      { name: 'Cherlapally', lat: 17.4765, lng: 78.5840 },
      { name: 'HCU Gate', lat: 17.4642, lng: 78.5982 },
    ],
  },
  {
    routeNumber: '175',
    name: 'LB Nagar → Hayathnagar',
    routeType: 'LOCAL',
    distance: 16,
    avgSpeed: 20,
    stops: [
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Nagole', lat: 17.3822, lng: 78.5505 },
      { name: 'Vanasthalipuram', lat: 17.3380, lng: 78.5530 },
      { name: 'Saroornagar', lat: 17.3267, lng: 78.5487 },
      { name: 'Meerpet', lat: 17.3150, lng: 78.5590 },
      { name: 'Hayathnagar', lat: 17.3060, lng: 78.5860 },
    ],
  },
  {
    routeNumber: '17D',
    name: 'Dilsukhnagar → Meerpet',
    routeType: 'LOCAL',
    distance: 12,
    avgSpeed: 18,
    stops: [
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
      { name: 'Kothapet', lat: 17.3592, lng: 78.5353 },
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Vanasthalipuram', lat: 17.3380, lng: 78.5530 },
      { name: 'Saroornagar', lat: 17.3267, lng: 78.5487 },
      { name: 'Meerpet', lat: 17.3150, lng: 78.5590 },
    ],
  },
  {
    routeNumber: '290K',
    name: 'KPHB → Kompally Circular',
    routeType: 'LOCAL',
    distance: 22,
    avgSpeed: 22,
    stops: [
      { name: 'KPHB Colony', lat: 17.4946, lng: 78.3901 },
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
      { name: 'Bachupally', lat: 17.5170, lng: 78.3760 },
      { name: 'Nizampet', lat: 17.5208, lng: 78.3848 },
      { name: 'Pragati Nagar', lat: 17.5150, lng: 78.4250 },
      { name: 'Suchitra', lat: 17.4937, lng: 78.4885 },
      { name: 'Kompally', lat: 17.5337, lng: 78.4865 },
      { name: 'Bahadurpally', lat: 17.5628, lng: 78.4524 },
    ],
  },
  {
    routeNumber: '44L',
    name: 'Nagole → Meerpet Loop',
    routeType: 'LOCAL',
    distance: 14,
    avgSpeed: 18,
    stops: [
      { name: 'Nagole', lat: 17.3822, lng: 78.5505 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Vanasthalipuram', lat: 17.3380, lng: 78.5530 },
      { name: 'Saroornagar', lat: 17.3267, lng: 78.5487 },
      { name: 'Meerpet', lat: 17.3150, lng: 78.5590 },
    ],
  },
  {
    routeNumber: '47F',
    name: 'Financial District → MGBS',
    routeType: 'METRO_EXPRESS',
    distance: 30,
    avgSpeed: 35,
    stops: [
      { name: 'Financial District', lat: 17.4183, lng: 78.3363 },
      { name: 'Nanakramguda', lat: 17.4325, lng: 78.3406 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Manikonda', lat: 17.4038, lng: 78.3770 },
      { name: 'Tolichowki', lat: 17.3879, lng: 78.4154 },
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
      { name: 'Masab Tank', lat: 17.3993, lng: 78.4546 },
      { name: 'Lakdi-ka-pul', lat: 17.4005, lng: 78.4667 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
    ],
  },
  {
    routeNumber: '800',
    name: 'Shamshabad → Hitech City',
    routeType: 'EXPRESS',
    distance: 36,
    avgSpeed: 40,
    stops: [
      { name: 'Shamshabad Airport', lat: 17.2403, lng: 78.4294 },
      { name: 'Shamshabad', lat: 17.2543, lng: 78.4287 },
      { name: 'Rajendra Nagar', lat: 17.3427, lng: 78.4156 },
      { name: 'Narsingi', lat: 17.3944, lng: 78.3240 },
      { name: 'Financial District', lat: 17.4183, lng: 78.3363 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Hitech City', lat: 17.4474, lng: 78.3762 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
    ],
  },
  {
    routeNumber: '22B',
    name: 'Banjara Hills → Hitech City',
    routeType: 'LOCAL',
    distance: 14,
    avgSpeed: 20,
    stops: [
      { name: 'Banjara Hills', lat: 17.4156, lng: 78.4484 },
      { name: 'Banjara Hills Road No 12', lat: 17.4237, lng: 78.4423 },
      { name: 'Jubilee Hills Check Post', lat: 17.4270, lng: 78.4120 },
      { name: 'Film Nagar', lat: 17.4190, lng: 78.3990 },
      { name: 'Jubilee Hills Road No 36', lat: 17.4250, lng: 78.4250 },
      { name: 'Kondapur', lat: 17.4600, lng: 78.3738 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
      { name: 'Hitech City', lat: 17.4474, lng: 78.3762 },
    ],
  },
  {
    routeNumber: '212E',
    name: 'Medchal → JBS Express',
    routeType: 'EXPRESS',
    distance: 36,
    avgSpeed: 32,
    stops: [
      { name: 'Medchal', lat: 17.6319, lng: 78.4816 },
      { name: 'Kompally', lat: 17.5337, lng: 78.4865 },
      { name: 'Suchitra', lat: 17.4937, lng: 78.4885 },
      { name: 'Alwal', lat: 17.4990, lng: 78.5010 },
      { name: 'Bowenpally', lat: 17.4620, lng: 78.4760 },
      { name: 'Trimulgherry', lat: 17.4555, lng: 78.4860 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Paradise', lat: 17.4422, lng: 78.4833 },
      { name: 'JBS (Jubilee Bus Station)', lat: 17.4531, lng: 78.4985 },
    ],
  },
  {
    routeNumber: '188B',
    name: 'Uppal → Bhongir',
    routeType: 'EXPRESS',
    distance: 42,
    avgSpeed: 38,
    stops: [
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'Narapally', lat: 17.4122, lng: 78.6361 },
      { name: 'Ghatkesar', lat: 17.4500, lng: 78.6830 },
      { name: 'Choutuppal', lat: 17.2531, lng: 78.9265 },
      { name: 'Bibinagar', lat: 17.4450, lng: 78.8940 },
      { name: 'Bhongir', lat: 17.5134, lng: 78.8875 },
    ],
  },
  {
    routeNumber: '47M',
    name: 'Miyapur → Chandanagar',
    routeType: 'LOCAL',
    distance: 12,
    avgSpeed: 22,
    stops: [
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
      { name: 'Chandanagar', lat: 17.5010, lng: 78.3270 },
      { name: 'Tellapur', lat: 17.5060, lng: 78.3030 },
      { name: 'Gopanpally', lat: 17.4920, lng: 78.3090 },
      { name: 'Nallagandla', lat: 17.4820, lng: 78.3150 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Kondapur', lat: 17.4600, lng: 78.3738 },
    ],
  },
  {
    routeNumber: '55',
    name: 'Abids → Barkas',
    routeType: 'LOCAL',
    distance: 10,
    avgSpeed: 16,
    stops: [
      { name: 'Abids', lat: 17.3899, lng: 78.4743 },
      { name: 'Koti', lat: 17.3860, lng: 78.4880 },
      { name: 'Sultan Bazaar', lat: 17.3900, lng: 78.4880 },
      { name: 'Afzalgunj', lat: 17.3756, lng: 78.4768 },
      { name: 'Charminar', lat: 17.3616, lng: 78.4747 },
      { name: 'Shalibanda', lat: 17.3650, lng: 78.4830 },
      { name: 'Santoshnagar', lat: 17.3478, lng: 78.4903 },
      { name: 'Barkas', lat: 17.3320, lng: 78.5030 },
    ],
  },
  {
    routeNumber: '66S',
    name: 'Masab Tank → Rajendra Nagar',
    routeType: 'LOCAL',
    distance: 14,
    avgSpeed: 20,
    stops: [
      { name: 'Masab Tank', lat: 17.3993, lng: 78.4546 },
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
      { name: 'Attapur', lat: 17.3757, lng: 78.4254 },
      { name: 'Langerhouse', lat: 17.3600, lng: 78.4210 },
      { name: 'Mailardevpally', lat: 17.3480, lng: 78.4270 },
      { name: 'Rajendra Nagar', lat: 17.3427, lng: 78.4156 },
      { name: 'Aramghar', lat: 17.3224, lng: 78.4431 },
    ],
  },
  {
    routeNumber: '39N',
    name: 'Nacharam → Begumpet',
    routeType: 'LOCAL',
    distance: 18,
    avgSpeed: 22,
    stops: [
      { name: 'Nacharam', lat: 17.4130, lng: 78.5470 },
      { name: 'Habsiguda', lat: 17.4090, lng: 78.5340 },
      { name: 'Tarnaka', lat: 17.4270, lng: 78.5210 },
      { name: 'Mettuguda', lat: 17.4340, lng: 78.5110 },
      { name: 'Musheerabad', lat: 17.4200, lng: 78.4880 },
      { name: 'Tankbund', lat: 17.4140, lng: 78.4760 },
      { name: 'Indira Park', lat: 17.4165, lng: 78.4750 },
      { name: 'SP Road', lat: 17.4260, lng: 78.4700 },
      { name: 'Begumpet', lat: 17.4430, lng: 78.4686 },
    ],
  },
  {
    routeNumber: '144',
    name: 'Banjara Hills → Nampally',
    routeType: 'LOCAL',
    distance: 9,
    avgSpeed: 18,
    stops: [
      { name: 'Banjara Hills', lat: 17.4156, lng: 78.4484 },
      { name: 'Masab Tank', lat: 17.3993, lng: 78.4546 },
      { name: 'Basheerbagh', lat: 17.4000, lng: 78.4660 },
      { name: 'Abids', lat: 17.3899, lng: 78.4743 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
    ],
  },
  {
    routeNumber: '19H',
    name: 'Miyapur → Madhapur Ring',
    routeType: 'LOCAL',
    distance: 12,
    avgSpeed: 22,
    stops: [
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
      { name: 'Hafeezpet', lat: 17.4860, lng: 78.3670 },
      { name: 'Kondapur', lat: 17.4600, lng: 78.3738 },
      { name: 'Functional Industrial Estate', lat: 17.4520, lng: 78.3820 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
    ],
  },

  // ── Phase 9.1: Corridor Routes (Hub Connectors) ──────────────────────────
  // Ghatkesar → Narapally → Uppal → Secunderabad Station
  {
    routeNumber: 'CX-EC',
    name: 'Ghatkesar → Secunderabad (East-Core Corridor)',
    routeType: 'EXPRESS',
    distance: 34,
    avgSpeed: 32,
    stops: [
      { name: 'Ghatkesar', lat: 17.4500, lng: 78.6830 },
      { name: 'Narapally', lat: 17.4122, lng: 78.6361 },
      { name: 'Boduppal', lat: 17.4120, lng: 78.6110 },
      { name: 'Peerzadiguda', lat: 17.4100, lng: 78.5920 },
      { name: 'Uppal', lat: 17.3986, lng: 78.5589 },
      { name: 'Habsiguda', lat: 17.4090, lng: 78.5340 },
      { name: 'Tarnaka', lat: 17.4270, lng: 78.5210 },
      { name: 'Mettuguda', lat: 17.4340, lng: 78.5110 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },

  // CORRIDOR 2: Core ↔ West (via key hubs)
  // Secunderabad Station → Paradise → Begumpet → Ameerpet → Miyapur
  {
    routeNumber: 'CX-CW',
    name: 'Secunderabad → Miyapur (Core-West Corridor)',
    routeType: 'EXPRESS',
    distance: 28,
    avgSpeed: 30,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Paradise', lat: 17.4422, lng: 78.4833 },
      { name: 'Begumpet', lat: 17.4430, lng: 78.4686 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'SR Nagar', lat: 17.4402, lng: 78.4399 },
      { name: 'ESI Hospital', lat: 17.4485, lng: 78.4321 },
      { name: 'Erragadda', lat: 17.4534, lng: 78.4267 },
      { name: 'Kukatpally', lat: 17.4849, lng: 78.3942 },
      { name: 'KPHB Colony', lat: 17.4946, lng: 78.3901 },
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
    ],
  },

  // CORRIDOR 3: Core ↔ IT Corridor (THE CRITICAL MISSING LINK)
  // Secunderabad Station → Ameerpet → Mehdipatnam → Gachibowli → Narsingi
  {
    routeNumber: 'CX-CI',
    name: 'Secunderabad → Narsingi (Core-IT Corridor)',
    routeType: 'METRO_EXPRESS',
    distance: 38,
    avgSpeed: 34,
    stops: [
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
      { name: 'Paradise', lat: 17.4422, lng: 78.4833 },
      { name: 'Begumpet', lat: 17.4430, lng: 78.4686 },
      { name: 'Ameerpet', lat: 17.4375, lng: 78.4483 },
      { name: 'Panjagutta', lat: 17.4280, lng: 78.4497 },
      { name: 'Lakdi-ka-pul', lat: 17.4005, lng: 78.4667 },
      { name: 'Mehdipatnam', lat: 17.3950, lng: 78.4408 },
      { name: 'Tolichowki', lat: 17.3879, lng: 78.4154 },
      { name: 'Manikonda', lat: 17.4038, lng: 78.3770 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Financial District', lat: 17.4183, lng: 78.3363 },
      { name: 'Narsingi', lat: 17.3944, lng: 78.3240 },
    ],
  },

  // CORRIDOR 4: West ↔ IT Corridor
  // Miyapur → Hitech City → Gachibowli → Financial District → Narsingi
  {
    routeNumber: 'CX-WI',
    name: 'Miyapur → Narsingi (West-IT Corridor)',
    routeType: 'EXPRESS',
    distance: 20,
    avgSpeed: 30,
    stops: [
      { name: 'Miyapur', lat: 17.4969, lng: 78.3538 },
      { name: 'Hafeezpet', lat: 17.4860, lng: 78.3670 },
      { name: 'Kondapur', lat: 17.4600, lng: 78.3738 },
      { name: 'Madhapur', lat: 17.4484, lng: 78.3908 },
      { name: 'Hitech City', lat: 17.4474, lng: 78.3762 },
      { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
      { name: 'Nanakramguda', lat: 17.4325, lng: 78.3406 },
      { name: 'Financial District', lat: 17.4183, lng: 78.3363 },
      { name: 'Kokapet', lat: 17.4060, lng: 78.3270 },
      { name: 'Narsingi', lat: 17.3944, lng: 78.3240 },
    ],
  },

  // CORRIDOR 5: South-East ↔ Core (LB Nagar → Secunderabad via different path)
  // LB Nagar → Dilsukhnagar → MGBS → Abids → Secunderabad Station
  {
    routeNumber: 'CX-SC',
    name: 'LB Nagar → Secunderabad (South-Core Corridor)',
    routeType: 'EXPRESS',
    distance: 24,
    avgSpeed: 28,
    stops: [
      { name: 'LB Nagar', lat: 17.3496, lng: 78.5489 },
      { name: 'Kothapet', lat: 17.3592, lng: 78.5353 },
      { name: 'Dilsukhnagar', lat: 17.3688, lng: 78.5241 },
      { name: 'Malakpet', lat: 17.3749, lng: 78.4998 },
      { name: 'Chaderghat', lat: 17.3804, lng: 78.4921 },
      { name: 'MGBS Bus Station', lat: 17.3784, lng: 78.4867 },
      { name: 'Nampally', lat: 17.3883, lng: 78.4719 },
      { name: 'Abids', lat: 17.3899, lng: 78.4743 },
      { name: 'Koti', lat: 17.3860, lng: 78.4880 },
      { name: 'Sultan Bazaar', lat: 17.3900, lng: 78.4880 },
      { name: 'Secunderabad Station', lat: 17.4344, lng: 78.5013 },
    ],
  },
];

// ── Seed logic ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚌 Seeding TSRTC HydGo database …');

  // 1. Admin user
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      phone: ADMIN_PHONE,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Admin user: ${ADMIN_EMAIL}`);

  // 2. Test passenger
  const passengerHash = await bcrypt.hash('Passenger@2026', 12);
  await prisma.user.upsert({
    where: { email: 'passenger@hydgo.com' },
    update: {},
    create: {
      name: 'Test Passenger',
      email: 'passenger@hydgo.com',
      password: passengerHash,
      phone: '+919900000002',
      role: 'PASSENGER',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ Test passenger: passenger@hydgo.com');

  // 3. Test driver
  const driverHash = await bcrypt.hash('Driver@2026', 12);
  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@hydgo.com' },
    update: {},
    create: {
      name: 'Test Driver',
      email: 'driver@hydgo.com',
      password: driverHash,
      phone: '+919900000003',
      role: 'DRIVER',
      status: 'ACTIVE',
    },
  });

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      licenseNumber: 'TS-DRV-00001',
      approved: true,
    },
  });
  console.log('  ✅ Test driver: driver@hydgo.com (approved)');

  // 4. Routes & Stops
  for (const r of routes) {
    // Build polyline JSON from stops
    const polyline = JSON.stringify(r.stops.map((s) => [s.lat, s.lng]));

    const route = await prisma.route.upsert({
      where: { routeNumber: r.routeNumber },
      update: {},
      create: {
        routeNumber: r.routeNumber,
        name: r.name,
        routeType: r.routeType,
        polyline,
        distance: r.distance,
        avgSpeed: r.avgSpeed,
      },
    });

    // Remove old stops and re-create
    await prisma.stop.deleteMany({ where: { routeId: route.id } });

    for (let i = 0; i < r.stops.length; i++) {
      const s = r.stops[i];
      await prisma.stop.create({
        data: {
          name: s.name,
          latitude: s.lat,
          longitude: s.lng,
          routeId: route.id,
          stopOrder: i + 1,
        },
      });
    }

    console.log(`  ✅ Route ${r.routeNumber}: ${r.name} (${r.stops.length} stops)`);
  }

  console.log('\n🎉 Seed complete!');
}

// ── Run ──────────────────────────────────────────────────────────────────────

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
