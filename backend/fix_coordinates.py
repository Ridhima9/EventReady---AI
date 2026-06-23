import pandas as pd
import numpy as np
import json
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    a = sin(dLat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = R * c
    return distance

def main():
    df = pd.read_csv("dataset/events_cleaned.csv")
    junction_coords = {}
    
    for junction, group in df.groupby("junction"):
        median_lat = group["latitude"].median()
        median_lon = group["longitude"].median()
        
        max_dist = 0
        for _, row in group.iterrows():
            dist = haversine(median_lat, median_lon, row["latitude"], row["longitude"])
            if dist > max_dist:
                max_dist = dist
        
        junction_coords[junction] = {
            "lat": median_lat,
            "lng": median_lon,
            "max_distance_km": max_dist,
            "approximate_location": max_dist > 3.0
        }
    
    with open("data/junction_coordinates.json", "w") as f:
        json.dump(junction_coords, f, indent=2)

    print(f"Computed coordinates for {len(junction_coords)} junctions.")
    num_approx = sum(1 for j in junction_coords.values() if j["approximate_location"])
    print(f"Junctions needing 'Approximate location' flag: {num_approx} out of {len(junction_coords)}")

    # Specific check for Mysore Road / Byatarayanapura
    target_j = None
    for j in junction_coords:
        if "17th Mn 1st Crs Aishwarya Stores Jn" in str(j):
            target_j = j
            break
    
    if target_j:
        raw_row = df[df["junction"] == target_j].iloc[0]
        raw_lat = raw_row["latitude"]
        raw_lon = raw_row["longitude"]
        print(f"\nVerification for: {target_j}")
        print(f"Before (raw row 0): {raw_lat}, {raw_lon}")
        print(f"After (canonical):  {junction_coords[target_j]['lat']}, {junction_coords[target_j]['lng']}")
        print(f"Max distance:       {junction_coords[target_j]['max_distance_km']:.2f} km")
        print(f"Approximate flag:   {junction_coords[target_j]['approximate_location']}")
    else:
        print("\nTarget junction '17th Mn 1st Crs Aishwarya Stores Jn' not found!")

if __name__ == "__main__":
    main()
