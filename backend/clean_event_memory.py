import pandas as pd
import json

def clean_event_memory():
    input_file = 'data/event_memory.csv'
    output_file = 'data/event_memory_clean.csv'
    
    # 1. Malformed Rows
    with open(input_file, 'r') as f:
        lines = f.readlines()
        
    header = lines[0].strip().split(',')
    expected_cols = len(header)
    
    valid_lines = [lines[0].strip()]
    malformed_examples = []
    
    for line in lines[1:]:
        cols = line.strip().split(',')
        if len(cols) != expected_cols or not cols[0] or not cols[1]:
            if len(malformed_examples) < 5:
                malformed_examples.append(line.strip())
        else:
            valid_lines.append(line.strip())
            
    print(f'Dropped {len(lines) - len(valid_lines)} malformed rows.')
    print('Examples of malformed rows:')
    for ex in malformed_examples:
        print(f'  {ex}')
    
    with open('data/temp_clean.csv', 'w') as f:
        f.write('\n'.join(valid_lines) + '\n')
        
    df = pd.read_csv('data/temp_clean.csv')
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # 2. Synthetic Block
    unknown_df = df[df['junction'] == 'Unknown'].copy()
    unknown_df = unknown_df.sort_values('timestamp')
    
    synthetic_indices = set()
    synthetic_examples = []
    
    unknown_df['offset'] = unknown_df['timestamp'].dt.hour % 3 * 3600 + unknown_df['timestamp'].dt.minute * 60 + unknown_df['timestamp'].dt.second
    offset_counts = unknown_df['offset'].value_counts()
    synthetic_offsets = offset_counts[offset_counts >= 10].index
    
    for idx, row in unknown_df.iterrows():
        if row['offset'] in synthetic_offsets:
            synthetic_indices.add(idx)
            if len(synthetic_examples) < 5:
                row_dict = row.drop('offset').to_dict()
                row_dict['timestamp'] = str(row_dict['timestamp'])
                synthetic_examples.append(row_dict)
                
    print(f'\nDropped {len(synthetic_indices)} synthetic rows.')
    print(f'The demo-seed creates 40 rows per invocation. Thus it was called {len(synthetic_indices) / 40} times.')
    print('Examples of synthetic rows:')
    for ex in synthetic_examples:
        print(f'  {json.dumps(ex)}')
        
    df = df.drop(index=list(synthetic_indices)).reset_index(drop=True)
    
    # 3. Duplicates
    df = df.sort_values('timestamp').reset_index(drop=True)
    duplicate_indices = set()
    duplicate_examples = []
    
    for i in range(1, len(df)):
        prev = df.iloc[i-1]
        curr = df.iloc[i]
        
        if (prev['event_cause'] == curr['event_cause'] and 
            prev['corridor'] == curr['corridor'] and
            prev['junction'] == curr['junction'] and
            prev['outcome'] == curr['outcome']):
            
            if abs((curr['timestamp'] - prev['timestamp']).total_seconds()) <= 10:
                duplicate_indices.add(i)
                if len(duplicate_examples) < 5:
                    row_dict = curr.to_dict()
                    row_dict['timestamp'] = str(row_dict['timestamp'])
                    duplicate_examples.append(row_dict)
                    
    print(f'\nDropped {len(duplicate_indices)} duplicate rows.')
    print('Examples of duplicate rows:')
    for ex in duplicate_examples:
        print(f'  {json.dumps(ex)}')
        
    df = df.drop(index=list(duplicate_indices)).reset_index(drop=True)
    
    # Output final clean csv
    df.to_csv(output_file, index=False)
    
    import os
    os.remove('data/temp_clean.csv')
    
    print(f'\nFinal usable rows remaining: {len(df)}')
    print('Outcome breakdown:')
    print(df['outcome'].value_counts())

if __name__ == '__main__':
    clean_event_memory()
