import networkx as nx

class CausalDiagnosticEngine:
  def __init__(self):
    # Initialize DAG structure for clinical diagnosis and recovery outcomes
    self.dag = nx.DiGraph()
    
    # Nodes list
    # Age (Confounder)
    # Pneumonia (Disease / Exposure)
    # Opacity (Radiographic indicator / Mediator)
    # Fever (Clinical Symptom)
    # Antibiotic_Treatment (Intervention)
    # Recovery_Outcome (Target Outcome)
    # Hospital_Admission_Bias (Selection Confounder)
    
    self.nodes = [
      "Age", "Pneumonia", "Opacity", "Fever", 
      "Antibiotic_Treatment", "Recovery_Outcome", "Hospital_Admission_Bias"
    ]
    self.dag.add_nodes_from(self.nodes)
    
    # Causal Edges
    self.edges = [
      ("Age", "Pneumonia"),
      ("Age", "Recovery_Outcome"),
      ("Pneumonia", "Opacity"),
      ("Pneumonia", "Fever"),
      ("Pneumonia", "Recovery_Outcome"),
      ("Antibiotic_Treatment", "Recovery_Outcome"),
      ("Pneumonia", "Antibiotic_Treatment"), # Physicians prescribe based on diagnosis
      ("Hospital_Admission_Bias", "Pneumonia"),
      ("Hospital_Admission_Bias", "Recovery_Outcome")
    ]
    self.dag.add_edges_from(self.edges)

  def get_dag_structure(self):
    """
    Returns nodes and edges with weights representing causal strengths
    """
    nodes = list(self.dag.nodes)
    edges = []
    
    # Define arbitrary but clinically sound causal weights
    weights = {
      ("Age", "Pneumonia"): 0.35,
      ("Age", "Recovery_Outcome"): -0.25,
      ("Pneumonia", "Opacity"): 0.85,
      ("Pneumonia", "Fever"): 0.72,
      ("Pneumonia", "Recovery_Outcome"): -0.55,
      ("Antibiotic_Treatment", "Recovery_Outcome"): 0.78,
      ("Pneumonia", "Antibiotic_Treatment"): 0.90,
      ("Hospital_Admission_Bias", "Pneumonia"): 0.15,
      ("Hospital_Admission_Bias", "Recovery_Outcome"): -0.10
    }
    
    for u, v in self.dag.edges:
      edges.append({
        "from": u,
        "to": v,
        "weight": weights.get((u, v), 0.5)
      })
      
    return {"nodes": nodes, "edges": edges}

  def calculate_backdoor_adjustment(self, exposure="Pneumonia", outcome="Recovery_Outcome"):
    """
    Simulates calculating ATE adjusting for backdoor paths:
    Backdoor paths between Pneumonia -> Recovery:
    Pneumonia <- Age -> Recovery_Outcome (Age is a confounder, needs blocking)
    Pneumonia <- Hospital_Admission_Bias -> Recovery_Outcome (needs blocking to remove selection bias)
    """
    # Block confounders: Age, Hospital_Admission_Bias
    confounders = ["Age", "Hospital_Admission_Bias"]
    
    # Simulated adjusted effect of Pneumonia on Recovery:
    # Crude (unadjusted) correlation would look worse due to age/bias
    unadjusted_effect = -0.68
    adjusted_effect = -0.45 # Reduced severity correlation when adjusting for old age severity
    
    # Simulated effect of treatment intervention do(Antibiotic_Treatment = 1)
    treatment_ate = 0.58
    
    return {
      "exposure": exposure,
      "outcome": outcome,
      "identified_confounders": confounders,
      "unadjusted_effect": unadjusted_effect,
      "adjusted_effect": adjusted_effect,
      "treatment_average_effect": treatment_ate
    }

  def simulate_counterfactual(self, baseline_disease="Pneumonia", baseline_prob=0.92, interventions=None):
    """
    Evaluates 'What-If' scenarios.
    Example: interventions = {'Fever': 0, 'Opacity': 0}
    Recalculates updated probability of the disease state.
    """
    if not interventions:
      return {"interventions": {}, "updated_disease_probability": baseline_prob}
      
    updated_prob = baseline_prob
    explanations = []
    
    # Opacity is highly causal (weight 0.85). If we do(Opacity = 0), probability of pneumonia drops significantly.
    if 'Opacity' in interventions:
      val = interventions['Opacity']
      if val == 0:
        updated_prob -= 0.55
        explanations.append("Intervened do(Opacity = Absent): Substantial drop in diagnosis probability (X-ray signs absent).")
      else:
        updated_prob += 0.05
        
    # Fever (symptom, weight 0.72)
    if 'Fever' in interventions:
      val = interventions['Fever']
      if val == 0:
        updated_prob -= 0.20
        explanations.append("Intervened do(Fever = Absent): Moderate drop in probability (clinical symptoms subsided).")
      else:
        updated_prob += 0.08

    # Age confounder check
    if 'Age' in interventions:
      age_val = interventions['Age']
      if age_val < 30:
        updated_prob -= 0.10
        explanations.append("Intervened do(Age < 30): Reduced baseline vulnerability adjusted.")
      elif age_val > 70:
        updated_prob += 0.12
        explanations.append("Intervened do(Age > 70): Increased vulnerability adjusted.")

    # Bound probability between 0.01 and 0.99
    updated_prob = max(0.01, min(0.99, updated_prob))
    
    return {
      "original_probability": baseline_prob,
      "updated_probability": round(updated_prob, 3),
      "interventions": interventions,
      "explanations": explanations
    }
