import pandas as pd
import numpy as np
import json
from datetime import datetime

def process_exoplanet_data(input_csv="dataset.csv"):
    out_csv = "reduced_dataset.csv"
    out_precision_json = "precision_data.json"
    out_metadata_json = "metadata.json"
    out_summary_json = "summary_stats.json"

    # Extract date from header
    dataset_date = "Unknown date"
    with open(input_csv, 'r', encoding='utf-8') as f:
        lines = [next(f) for _ in range(5)]
        if len(lines) > 1 and lines[1].startswith('#'):
            raw_date_string = lines[1].replace('#', '').strip()
            try:
                parsed_date = datetime.strptime(raw_date_string, "%a %b %d %H:%M:%S %Y")
                dataset_date = parsed_date.strftime("%d %B %Y") 
            except ValueError:
                dataset_date = raw_date_string

    df = pd.read_csv(input_csv, comment='#')
    
    # Export metadata
    metadata = {
        "dataset_date": dataset_date,
        "total_planets": len(df),
        "total_systems": int(df['hostname'].nunique())
    }
    with open(out_metadata_json, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=4)

    # Export dataset summary statistics
    summary_cols = [
        'pl_orbper', 'pl_orbsmax', 'pl_rade', 'pl_radj', 'pl_bmasse', 
        'pl_bmassj', 'pl_orbeccen', 'st_teff', 'st_mass', 'st_rad', 
        'sy_dist', 'sy_gaiamag'
    ]
    summary_stats = {}
    
    for col in summary_cols:
        if col in df.columns:
            valid_data = df[col].dropna()
            if not valid_data.empty:
                summary_stats[col] = {
                    "min": float(valid_data.min()),
                    "max": float(valid_data.max()),
                    "median": float(valid_data.median())
                }
            else:
                summary_stats[col] = {"min": 0, "max": 0, "median": 0}
                
    with open(out_summary_json, 'w', encoding='utf-8') as f:
        json.dump(summary_stats, f, indent=4)

    # Export measurement precision stats
    metrics = {
        'orbper': {'val': 'pl_orbper', 'err1': 'pl_orbpererr1', 'err2': 'pl_orbpererr2'},
        'orbsmax': {'val': 'pl_orbsmax', 'err1': 'pl_orbsmaxerr1', 'err2': 'pl_orbsmaxerr2'},
        'bmasse': {'val': 'pl_bmasse', 'err1': 'pl_bmasseerr1', 'err2': 'pl_bmasseerr2'}
    }
    main_methods = ["Transit", "Radial Velocity", "Microlensing", "Imaging"]
    precision_data = {}
    
    for metric_key, cols in metrics.items():
        precision_data[metric_key] = []
        for method in main_methods:
            subset = df[df['discoverymethod'] == method]
            
            val = subset[cols['val']]
            err1 = subset[cols['err1']]
            err2 = subset[cols['err2']]
            
            # Filter for valid rows only
            valid_mask = (val > 0) & val.notna() & err1.notna() & err2.notna()
            valid = subset[valid_mask].copy()
            
            if valid.empty: continue
                
            abs_err = (valid[cols['err1']].abs() + valid[cols['err2']].abs()) / 2
            valid = valid[abs_err > 0] 
            
            if valid.empty: continue
                
            rel_err = abs_err / valid[cols['val']]
            precision = 1 / rel_err
            
            # Calculate box plot percentiles
            p_vals = precision.dropna().sort_values().values
            if len(p_vals) == 0: continue
                
            precision_data[metric_key].append({
                "method": method,
                "min": np.percentile(p_vals, 5),   
                "q1": np.percentile(p_vals, 25),   
                "median": np.percentile(p_vals, 50), 
                "q3": np.percentile(p_vals, 75),   
                "max": np.percentile(p_vals, 95),  
                "count": len(p_vals)               
            })

    with open(out_precision_json, 'w', encoding='utf-8') as f:
        json.dump(precision_data, f, indent=4)

    # Generate reduced CSV for visualisations
    keep_columns = [
        'pl_name', 'hostname', 'sy_pnum', 'discoverymethod', 'disc_year',
        'disc_locale', 'disc_facility', 'pl_orbper', 'pl_orbsmax',
        'pl_rade', 'pl_radj', 'pl_bmasse', 'pl_bmassj', 'pl_orbeccen',
        'st_teff', 'st_mass', 'st_rad', 'sy_dist', 'sy_gaiamag', 'ra', 'dec'
    ]
    
    df_reduced = df[keep_columns]
    df_reduced.to_csv(out_csv, index=False)

if __name__ == "__main__":
    process_exoplanet_data("exoplanet_dataset.csv")