export const CITY_COORDS: Record<string, [number, number]> = {
  "sydney":     [-33.8688, 151.2093],
  "melbourne":  [-37.8136, 144.9631],
  "brisbane":   [-27.4698, 153.0251],
  "perth":      [-31.9505, 115.8605],
  "adelaide":   [-34.9285, 138.6007],
  "gold coast": [-28.0167, 153.4000],
  "newcastle":  [-32.9283, 151.7817],
  "canberra":   [-35.2802, 149.1310],
  "hobart":     [-42.8821, 147.3272],
  "sunshine coast": [-26.6510, 153.0671],
  "wollongong": [-34.4224, 150.8931],
  "geelong":    [-38.1470, 144.3607],
  "townsville": [-19.2590, 146.8169],
  "cairns":     [-16.9186, 145.7781],
  "darwin":     [-12.4634, 130.8456],
  "toowoomba":  [-27.5606, 151.9541],
  "ballarat":   [-37.5495, 143.8159],
  "bendigo":    [-36.7519, 144.2817],
  "albury":     [-36.0806, 146.9155],
  "launceston": [-41.4384, 147.1347],
  "mackay":     [-21.1412, 149.1860],
  "rockhampton": [-23.3781, 150.5095],
  "fraser coast": [-25.2853, 152.8326],
  "bunbury":    [-33.3270, 115.6360],
  "coffs harbour": [-30.2962, 153.1135],
  "port macquarie": [-31.4332, 152.9081],
  "byron bay":  [-28.6474, 153.6020],
  "noosa":      [-26.3957, 153.0656],
  "surfers paradise": [-28.0067, 153.4291],
  "scoresby":   [-37.9006, 145.2390],
  "little river": [-37.9534, 144.4374],
  "yering":     [-37.6819, 145.3686],
  "uluru":      [-25.3444, 131.0369],
  "kiama":      [-34.6701, 150.8585],
  "busselton":  [-33.6524, 115.3475],
  "mount barker": [-35.0706, 138.8583],
};

export const STATE_CENTERS: Record<string, [number, number]> = {
  nsw: [-33.0, 147.0],
  vic: [-37.0, 145.0],
  qld: [-23.0, 144.0],
  wa:  [-25.0, 122.0],
  sa:  [-30.0, 135.0],
  tas: [-42.0, 147.0],
  act: [-35.3, 149.1],
  nt:  [-20.0, 134.0],
};

export function getEventCoords(city: string, state: string): [number, number] {
  const key = city.toLowerCase().trim();
  return CITY_COORDS[key] ?? STATE_CENTERS[state.toLowerCase()] ?? [-33.8688, 151.2093];
}
