#!/usr/bin/env python3
import sys
import os
import argparse
import json
import traceback

# Add the current directory to path to ensure correct imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from spu_log_analyzer import load_and_filter, build_output_paths, _sheet_filtered_export, build_analysis_report
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Import error: {str(e)}"}))
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Headless SPU Log Analyzer CLI")
    parser.add_argument("--file", required=True, help="Path to input log file")
    parser.add_argument("--start", required=True, help="Start time (HH:MM)")
    parser.add_argument("--end", required=True, help="End time (HH:MM)")
    parser.add_argument("--outdir", required=True, help="Output directory")
    
    args = parser.parse_args()
    
    if not os.path.isfile(args.file):
        print(json.dumps({"success": False, "error": f"Input file not found: {args.file}"}))
        sys.exit(1)
        
    try:
        start_full = args.start + ":00"
        end_full = args.end + ":59"
        
        # Load and clean
        filtered, alarms, df = load_and_filter(args.file, start_full, end_full, log_fn=None)
        
        if len(filtered) == 0:
            print(json.dumps({
                "success": False,
                "error": f"No log entries found in the range {args.start} to {args.end}."
            }))
            sys.exit(0)
            
        alarm_count = len(alarms)
        ca = len(alarms[alarms["Class"] == "A"]) if "Class" in alarms.columns else 0
        cb = len(alarms[alarms["Class"] == "B"]) if "Class" in alarms.columns else 0
        cc = len(alarms[alarms["Class"] == "C"]) if "Class" in alarms.columns else 0
        cd = len(alarms[alarms["Class"] == "D"]) if "Class" in alarms.columns else 0
        
        out_data, out_report = build_output_paths(args.file, args.start, args.end, args.outdir)
        
        # Generate reports
        _sheet_filtered_export(filtered, alarms, start_full, end_full, out_data)
        build_analysis_report(filtered, alarms, start_full, end_full, out_report)
        
        result = {
            "success": True,
            "total": len(filtered),
            "alarms": alarm_count,
            "classes": {
                "A": ca,
                "B": cb,
                "C": cc,
                "D": cd
            },
            "outputs": [
                os.path.abspath(out_data),
                os.path.abspath(out_report)
            ]
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "trace": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
