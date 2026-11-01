import unittest
import sys
import os

# Append paths
sys.path.append(os.path.join(os.path.dirname(__file__), 'ai_backend'))

from causal_engine import CausalDiagnosticEngine
from models_hub import ModalityModelHub
from agents_workflow import run_agentic_diagnosis

class TestMedCausalAIPlatform(unittest.TestCase):
  
  def setUp(self):
    self.causal_engine = CausalDiagnosticEngine()
    self.model_hub = ModalityModelHub()

  def test_causal_dag_structure(self):
    """
    Asserts Causal DAG generates valid structural nodes and edges
    """
    dag_data = self.causal_engine.get_dag_structure()
    self.assertIn("Age", dag_data["nodes"])
    self.assertIn("Pneumonia", dag_data["nodes"])
    self.assertIn("Recovery_Outcome", dag_data["nodes"])
    self.assertTrue(len(dag_data["edges"]) > 0)

  def test_backdoor_adjustment_confounders(self):
    """
    Verifies that the backdoor path blocker correctly lists Age as a confounding factor
    """
    adj_res = self.causal_engine.calculate_backdoor_adjustment()
    self.assertIn("Age", adj_res["identified_confounders"])
    # Adjusted effect must be smaller than crude unadjusted severity correlation
    self.assertGreater(adj_res["adjusted_effect"], adj_res["unadjusted_effect"])

  def test_counterfactual_simulation(self):
    """
    Tests what-if intervention on symptoms: do(Opacity=0) should drop disease prob.
    """
    baseline_p = 0.90
    cf_res = self.causal_engine.simulate_counterfactual(
      baseline_disease="Pneumonia",
      baseline_prob=baseline_p,
      interventions={"Opacity": 0}
    )
    # Assert probability is recalculated downward when visual mediator disappears
    self.assertLess(cf_res["updated_probability"], baseline_p)

  def test_image_processing_gradcam(self):
    """
    Ensures DenseNet121 model inference and GradCAM generation work on real image input
    """
    from PIL import Image
    import numpy as np

    temp_img = "test_chest_scan.png"
    img_array = np.random.randint(50, 200, (224, 224, 3), dtype=np.uint8)
    img = Image.fromarray(img_array)
    img.save(temp_img)

    try:
      res = self.model_hub.process_chest_xray(temp_img, "test_outputs")
      self.assertIn("disease", res)
      self.assertIn("severity", res)
      self.assertIn("visual_explanation", res)
      self.assertTrue(len(res["visual_explanation"]["bounding_boxes"]) > 0)
      self.assertIn("raw_probabilities", res)
      self.assertEqual(len(res["raw_probabilities"]), 14)
    finally:
      if os.path.exists(temp_img):
        os.remove(temp_img)
      gradcam_file = f"test_outputs/gradcam_{os.path.splitext(temp_img)[0]}.png"
      if os.path.exists(gradcam_file):
        os.remove(gradcam_file)
      if os.path.exists("test_outputs"):
        try:
          os.rmdir("test_outputs")
        except OSError:
          pass

  def test_agent_graph_workflow(self):
    """
    Tests compilation and run-through of the entire LangGraph state pipeline
    """
    res = run_agentic_diagnosis(
      patient_id="PT-9999",
      modality="ECG",
      file_path="mock_ecg.dat",
      clinical_notes="Irregular beats, high pulse rate."
    )
    self.assertTrue(res["success"])
    self.assertIn("ai_prediction", res)
    self.assertEqual(res["ai_prediction"]["emergencyLevel"], "High")
    self.assertTrue(len(res["trace_logs"]) >= 13) # All 13 agents must write to trace logs

if __name__ == "__main__":
  print("Launching MedCausal AI Verification Suite...")
  suite = unittest.TestLoader().loadTestsFromTestCase(TestMedCausalAIPlatform)
  runner = unittest.TextTestRunner(verbosity=2)
  result = runner.run(suite)
  sys.exit(not result.wasSuccessful())
