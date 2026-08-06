import { Room, Venue } from '../types/booking'

// 1. Initial Prepopulated Rooms List (Philippine Peso PMS Rates)
export const DEFAULT_ROOMS: Room[] = [
  {
    id: 'room-1',
    room_number: 1,
    name: 'Full Double Deluxe',
    base_price: 1755,
    capacity: 2,
    description: 'A large and comfortable room with a double bed, nice seating area, and a private balcony with a view of the city skyline.',
    image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-2',
    room_number: 2,
    name: 'Full Double',
    base_price: 1625,
    capacity: 2,
    description: 'A clean and quiet room with a double bed and a desk. Perfect for work or relaxation.',
    image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-3',
    room_number: 3,
    name: 'Full Double',
    base_price: 1625,
    capacity: 2,
    description: 'A cozy interior room with a double bed and warm, soft lighting. Safe and quiet.',
    image_url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-4',
    room_number: 4,
    name: 'Full Double',
    base_price: 1625,
    capacity: 2,
    description: 'A high room with a double bed, simple design, and a nice view of Manila Bay.',
    image_url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-5',
    room_number: 5,
    name: 'Matrimonial',
    base_price: 1950,
    capacity: 2,
    description: 'A nice room for couples. It has a queen bed, warm lighting, and a large private bathtub.',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-6',
    room_number: 6,
    name: 'Family Room',
    base_price: 2730,
    capacity: 5,
    description: 'A big room for families. It has two double beds, one single roll-away bed, and a dining table.',
    image_url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-7',
    room_number: 7,
    name: 'Bunk Bed 3',
    base_price: 2015,
    capacity: 3,
    description: 'A shared room with three comfortable bunk bed spaces, curtains for privacy, and power plugs.',
    image_url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-8',
    room_number: 8,
    name: 'Double',
    base_price: 1495,
    capacity: 2,
    description: 'A simple studio room with a double bed, private bathroom, and bright windows.',
    image_url: 'https://images.unsplash.com/photo-1611891404724-5f9a241e243b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-9',
    room_number: 9,
    name: 'Bunk Bed 2',
    base_price: 1560,
    capacity: 2,
    description: 'A cozy shared room with two parallel bunk bed spaces and warm lighting.',
    image_url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-10',
    room_number: 10,
    name: 'Bunk Bed 6',
    base_price: 4290,
    capacity: 6,
    description: 'A large group suite with six comfortable bunk bed spaces and two private bathrooms.',
    image_url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80'
  }
]

// 2. Prepopulated Event Venues
export const DEFAULT_VENUES: Venue[] = [
  {
    id: 'venue-gazebo',
    name: 'Gazebo',
    base_price: 5000,
    capacity: 50,
    description: 'A beautiful open-air gazebo. Includes 50 chairs, 9 tables, a speaker, and a water dispenser. Great for small parties and celebrations.',
    image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
    details: {
      chairs: 50,
      tables: 9,
      extras: ['Bluetooth Speaker', 'Water Dispenser']
    }
  },
  {
    id: 'venue-vacation',
    name: 'Vacation House',
    base_price: 15000,
    capacity: 50,
    description: 'A fully furnished house for staycations. Includes 50 chairs, 10 tables, and a large outdoor tent to protect against rain or sun.',
    image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    details: {
      chairs: 50,
      tables: 10,
      extras: ['Fully Furnished Interior', 'Big Weather-proof Tent']
    }
  },
  {
    id: 'venue-garden',
    name: 'Garden Area',
    base_price: 7500,
    capacity: 50,
    description: 'A green garden lawn with lovely hanging lights. Includes 50 chairs, 10 tables, and a large canopy tent.',
    image_url: 'https://images.unsplash.com/photo-1545232979-8bf34eb9757b?auto=format&fit=crop&w=800&q=80',
    details: {
      chairs: 50,
      tables: 10,
      extras: ['Outdoor string lights', 'Big Canopy Tent']
    }
  }
]
