"""
Common security functions for database scripts
"""
import random
import time

def math_challenge():
    """
    Math challenge for destructive operations
    Returns: True if challenge passed, False otherwise
    """
    num1 = random.randint(10, 99)
    num2 = random.randint(10, 99)
    expected_answer = num1 + num2
    
    print(f"\nSECURITY: Solve this math problem to confirm:")
    print(f"What is {num1} + {num2}?")
    
    # Record start time (anti-automation - must take at least 2 seconds)
    start_time = time.time()
    
    try:
        user_answer = input("Your answer: ").strip()
        elapsed_time = time.time() - start_time
        
        # Prevent instant automated responses
        if elapsed_time < 2.0:
            print("\nAnswer submitted too quickly. Please try again.")
            print("Operation cancelled for safety.")
            return False
        
        if int(user_answer) != expected_answer:
            print(f"\nIncorrect! The answer was {expected_answer}.")
            print("Operation cancelled for safety.")
            return False
            
    except (ValueError, EOFError):
        print("\nInvalid input. Operation cancelled.")
        return False
    
    print("\nCorrect! Proceeding...")
    return True
